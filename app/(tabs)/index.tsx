import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ADMIN_EMAIL, supabase } from '@/lib/supabase';
import { useDistrict, DISTRICTS, District } from '@/lib/DistrictContext';
import StoryViewer, { Story } from '@/components/StoryViewer';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';
const RED   = '#EA580C';

// ─── Category Config ─────────────────────────────────────────────────────────
// Segment tabs: Yerel · Ulusal · Sosyal · Arkadaşlar
const SEGMENT_CATEGORIES = ['Yerel', 'Ulusal', 'Sosyal', 'Arkadaşlar'] as const;
type SegmentCategory = (typeof SEGMENT_CATEGORIES)[number];

const CATEGORY_ORDER: Record<string, number> = {
  Yerel: 0, Ulusal: 1, Sosyal: 2, 'Arkadaşlar': 3,
};

// Posting roles — used by the header "+" auth guard
const POSTING_ROLES = ['admin', 'editor', 'pro'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type FeedItem = {
  id             : string;
  image          : string;
  media_type     : string | null;
  category       : string;
  categoryColor  : string;
  title          : string;
  description    : string;
  createdAt      : string | null;
  authorUsername : string | null;
  authorId       : string | null;
  authorRole     : string | null;
};

type FeedRow = {
  id            : string;
  image         : string;
  media_type    : string | null;
  category      : string;
  category_color: string;
  title         : string;
  description   : string;
  created_at    : string | null;
  user_id       : string | null;
  profiles      : { username: string; role: string | null } | null;
};

type StoryRow = {
  id        : string;
  media_url : string;
  media_type: 'image' | 'video';
  district  : string;
  category  : string | null;
  title     : string | null;
  created_at: string;
  user_id   : string | null;
};

type LikeState = { count: number; likedByMe: boolean };

// ─── Mappers ──────────────────────────────────────────────────────────────────
function mapFeed(row: FeedRow): FeedItem {
  const profiles = row.profiles as { username?: string; role?: string | null } | null;
  return {
    id            : String(row.id),
    image         : row.image ?? '',
    media_type    : row.media_type ?? null,
    category      : row.category,
    categoryColor : row.category_color ?? OLIVE,
    title         : row.title,
    description   : row.description,
    createdAt     : row.created_at ?? null,
    authorUsername: profiles?.username ?? null,
    authorId      : row.user_id ?? null,
    authorRole    : profiles?.role ?? null,
  };
}

function mapStory(row: StoryRow): Story & { category: string; user_id: string | null } {
  return {
    id        : String(row.id),
    media_url : row.media_url,
    media_type: row.media_type,
    district  : row.district,
    category  : row.category ?? 'Yerel',
    title     : row.title,
    created_at: row.created_at,
    user_id   : row.user_id ?? null,
  };
}

// ─── Time-ago helper (Turkish) ────────────────────────────────────────────────
function timeAgo(ds: string | null): string {
  if (!ds) return '';
  const now = new Date(), date = new Date(ds);
  const s   = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (s < 60)  return 'Az önce';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d} gün önce`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// ─── Short time-ago (for image overlay badge) ────────────────────────────────
function timeAgoShort(ds: string | null): string {
  if (!ds) return '';
  const now = new Date(), date = new Date(ds);
  const s   = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (s < 60)  return 'Şimdi';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}sa`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}g`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

// ─── Video detection ──────────────────────────────────────────────────────────
function isFeedVideo(item: FeedItem): boolean {
  if (item.media_type === 'video') return true;
  if (item.image) {
    const ext = item.image.split('?')[0].split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'mov' || ext === 'm4v' || ext === 'webm' || ext === 'avi';
  }
  return false;
}

// ─── Dropdown Modal (district selector) ──────────────────────────────────────
function DropdownModal<T extends string>({
  visible, items, selected, onSelect, onClose, title,
}: {
  visible: boolean; items: readonly T[]; selected: T;
  onSelect: (v: T) => void; onClose: () => void; title: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dropdownCard}>
              <Text style={styles.dropdownTitle}>{title}</Text>
              {items.map((item, i) => {
                const isLast   = i === items.length - 1;
                const isActive = item === selected;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.dropdownItem, !isLast && styles.dropdownItemBorder]}
                    activeOpacity={0.7}
                    onPress={() => { onSelect(item); onClose(); }}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <Ionicons name="location-outline" size={18} color={isActive ? OLIVE : '#94A3B8'} />
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemActive]}>{item}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={OLIVE} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Admin "+" Button ─────────────────────────────────────────────────────────
function AddStoryButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.storyItem} activeOpacity={0.75} onPress={onPress}>
      <LinearGradient colors={[OLIVE, '#84CC16']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.storyRing}>
        <View style={[styles.storyInner, { backgroundColor: '#fff' }]}>
          <View style={styles.addStoryCenter}>
            <Ionicons name="add" size={28} color={OLIVE} />
          </View>
        </View>
      </LinearGradient>
      <Text style={styles.storyLabel}>Ekle</Text>
    </TouchableOpacity>
  );
}

// ─── Story Thumbnail ──────────────────────────────────────────────────────────
function StoryItem({
  story, viewed, onPress,
}: {
  story: Story & { category?: string };
  viewed: boolean;
  onPress: () => void;
}) {
  const label = story.title ? story.title.split(' ').slice(0, 2).join(' ') : 'Hikaye';
  return (
    <TouchableOpacity style={styles.storyItem} activeOpacity={0.75} onPress={onPress}>
      {viewed ? (
        <View style={[styles.storyRing, styles.storyRingViewed]}>
          <View style={styles.storyInner}>
            <Image source={{ uri: story.media_url }} style={styles.storyImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          </View>
        </View>
      ) : (
        <LinearGradient colors={[OLIVE, '#84CC16']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.storyRing}>
          <View style={styles.storyInner}>
            <Image source={{ uri: story.media_url }} style={styles.storyImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          </View>
        </LinearGradient>
      )}
      <Text style={styles.storyLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Role badge config ────────────────────────────────────────────────────────
// Admin  → Gold/Red  (amber-orange, distinguishable, bold)
// Editör → Blue tick (deep sapphire checkmark)
// Pro    → Green tick (vivid emerald checkmark)
type RoleCfg = { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] };
function getFeedRoleConfig(role: string | null): RoleCfg | null {
  if (role === 'admin')  return { label: 'Admin',  color: '#C2410C', bg: '#FFF7ED', icon: 'shield-checkmark' };
  if (role === 'editor') return { label: 'Editör', color: '#1D4ED8', bg: '#EFF6FF', icon: 'checkmark-circle' };
  if (role === 'pro')    return { label: 'Pro',    color: '#15803D', bg: '#F0FDF4', icon: 'checkmark-circle' };
  return null;
}

// ─── Feed Card ────────────────────────────────────────────────────────────────
function FeedCard({
  item, likeState, canDelete, onPress, onLike, onAuthorPress, onDelete,
}: {
  item      : FeedItem;
  likeState : LikeState;
  /** Show the trash icon — true when viewer is Admin or owns this post */
  canDelete?: boolean;
  onPress?  : () => void;
  onLike?   : () => void;
  onAuthorPress?: () => void;
  onDelete? : () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isVideo = isFeedVideo(item);
  const tsShort = timeAgoShort(item.createdAt);
  const rc      = getFeedRoleConfig(item.authorRole);

  return (
    <TouchableOpacity style={styles.feedCard} activeOpacity={0.92} onPress={onPress}>

      {/* ── Thumbnail + Info Badge overlay ── */}
      <View style={styles.feedImageWrap}>
        {/* Media */}
        {item.image && !imgError ? (
          <Image
            key={item.id}
            source={{ uri: item.image }}
            style={styles.feedImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.feedImage, styles.feedImageFallback]}>
            <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={26} color="#CBD5E1" />
          </View>
        )}

        {/* Video play indicator (centered) */}
        {isVideo && item.image && !imgError && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        {/* ── Info Badge: [Timestamp] · [LikeCount] [♥] — solid pill, bottom-right ── */}
        <TouchableOpacity
          style={styles.imageBadge}
          activeOpacity={0.72}
          onPress={(e) => { e.stopPropagation(); onLike?.(); }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {tsShort !== '' && (
            <Text style={styles.imageTimestamp}>{tsShort}</Text>
          )}
          {tsShort !== '' && (
            <Text style={styles.imageSep}>·</Text>
          )}
          {likeState.count > 0 && (
            <Text style={[styles.imageLikeCount, likeState.likedByMe && styles.imageLikeCountActive]}>
              {likeState.count}
            </Text>
          )}
          <Ionicons
            name="heart"
            size={13}
            color={likeState.likedByMe ? '#FF3B5C' : 'rgba(255,255,255,0.65)'}
          />
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      <View style={styles.feedContent}>

        {/* Category chip + video badge + delete button (RBAC) */}
        <View style={styles.feedCategoryRow}>

          {/* Left cluster: category + video badge */}
          <View style={styles.feedCategoryLeft}>
            <Text style={[styles.feedCategory, { color: item.categoryColor }]}>{item.category}</Text>
            {isVideo && (
              <View style={[styles.mediaTypeBadge, { backgroundColor: `${item.categoryColor}18` }]}>
                <Ionicons name="videocam" size={10} color={item.categoryColor} />
                <Text style={[styles.mediaTypeBadgeText, { color: item.categoryColor }]}>Video</Text>
              </View>
            )}
          </View>

          {/* Trash icon — only for Admin or post owner */}
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.55}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <Ionicons name="trash-outline" size={15} color="#CBD5E1" />
            </TouchableOpacity>
          )}

        </View>

        <Text style={styles.feedTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.feedDescription} numberOfLines={2}>{item.description}</Text>

        {/* Author username + role badge — tappable */}
        {item.authorUsername && (
          <TouchableOpacity
            style={styles.authorRow}
            activeOpacity={0.7}
            onPress={(e) => { e.stopPropagation(); onAuthorPress?.(); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="person-circle-outline" size={12} color="#94A3B8" />
            <Text style={styles.authorText}>@{item.authorUsername}</Text>
            {rc && (
              <View style={[styles.authorRoleBadge, { backgroundColor: rc.bg }]}>
                <Ionicons name={rc.icon} size={9} color={rc.color} />
                <Text style={[styles.authorRoleBadgeText, { color: rc.color }]}>{rc.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

      </View>
    </TouchableOpacity>
  );
}

// ─── Auth-guarded "Create Post" handler (used by header "+" button) ───────────
const POSTING_ROLES_CHECK = POSTING_ROLES as readonly string[];

async function handleCreatePost(router: ReturnType<typeof useRouter>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    Alert.alert(
      'Giriş Yapın',
      'Devam etmek için giriş yapmalısınız.',
      [
        { text: 'Giriş Yap', onPress: () => router.push('/auth') },
        { text: 'Vazgeç', style: 'cancel' },
      ]
    );
    return;
  }

  if (session.user.email === ADMIN_EMAIL) {
    router.push('/create-post');
    return;
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  const role = (profileData?.role ?? '') as string;

  if (!POSTING_ROLES_CHECK.includes(role)) {
    Alert.alert(
      'Yetki Gerekli',
      'Paylaşım yapmak için Pro veya Editör hesabı olmanız gerekmektedir.',
      [{ text: 'Tamam' }]
    );
    return;
  }

  router.push('/create-post');
}

// ─── Push notification token registration ─────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Physical device is required for push notifications
  if (!Device.isDevice) return null;

  // Android: ensure a notification channel exists
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    return token;
  } catch {
    return null;
  }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { selectedDistrict, setSelectedDistrict } = useDistrict();
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  const [activeFilter, setActiveFilter] = useState<SegmentCategory>('Yerel');

  // ── Feed ──
  const [feed,       setFeed      ] = useState<FeedItem[]>([]);
  const [loading,    setLoading   ] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Stories (typed to include category + user_id) ──
  type EnrichedStory = Story & { category: string; user_id: string | null };
  const [stories,    setStories   ] = useState<EnrichedStory[]>([]);
  const viewedIds = useRef<Set<string>>(new Set());

  // ── Auth ──
  const [userId,     setUserId    ] = useState<string | null>(null);
  const [isAdmin,    setIsAdmin   ] = useState(false);
  const [userRole,   setUserRole  ] = useState<string | null>(null);
  const [mutualIds,  setMutualIds ] = useState<Set<string>>(new Set());

  // ── Like states ──
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});

  // ── Story viewer ──
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex,   setViewerIndex  ] = useState(0);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);

  // ── Refresh user (auth + role) ────────────────────────────────────────────
  const refreshUser = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setUserId(uid);
    setIsAdmin(user?.email === ADMIN_EMAIL);

    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();
      setUserRole(prof?.role ?? null);
    } else {
      setUserRole(null);
    }

    return uid;
  }, []);

  // ── Load mutual friends ───────────────────────────────────────────────────
  const loadMutuals = useCallback(async (uid: string | null) => {
    if (!uid) { setMutualIds(new Set()); return; }

    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', uid);

    const followingIds = (followingData ?? []).map((r: { following_id: string }) => r.following_id);
    if (followingIds.length === 0) { setMutualIds(new Set()); return; }

    const { data: mutualData } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', uid)
      .in('follower_id', followingIds);

    const ids = new Set((mutualData ?? []).map((r: { follower_id: string }) => r.follower_id));
    setMutualIds(ids);
  }, []);

  // ── Fetch likes ───────────────────────────────────────────────────────────
  const fetchLikes = useCallback(async (postIds: string[], uid: string | null) => {
    if (postIds.length === 0) return;

    const { data: likesData } = await supabase
      .from('likes')
      .select('post_id, user_id')
      .in('post_id', postIds);

    const counts: Record<string, number> = {};
    const mySet = new Set<string>();

    for (const row of (likesData ?? [])) {
      counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
      if (uid && row.user_id === uid) mySet.add(row.post_id);
    }

    const states: Record<string, LikeState> = {};
    for (const id of postIds) {
      states[id] = { count: counts[id] ?? 0, likedByMe: mySet.has(id) };
    }
    setLikeStates(states);
  }, []);

  // ── Master data fetcher ───────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const uid = await refreshUser();
      await loadMutuals(uid);

      const [feedRes, storyRes] = await Promise.all([
        supabase
          .from('feed')
          .select('id, image, media_type, category, category_color, title, description, created_at, user_id, profiles(username, role)')
          .eq('district', selectedDistrict)
          .order('created_at', { ascending: false }),
        supabase
          .from('stories')
          .select('id, media_url, media_type, district, category, title, created_at, user_id')
          .eq('district', selectedDistrict)
          .order('created_at', { ascending: false }),
      ]);

      if (feedRes.error)  console.error('[feed]',    feedRes.error.message);
      if (storyRes.error) console.error('[stories]', storyRes.error.message);

      const feedItems = feedRes.data ? (feedRes.data as FeedRow[]).map(mapFeed) : [];
      setFeed(feedItems);

      if (storyRes.data) {
        const mapped = (storyRes.data as StoryRow[]).map(mapStory);
        // Sort by category order
        mapped.sort((a, b) =>
          (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
        );
        setStories(mapped);
      }

      if (feedItems.length > 0) {
        await fetchLikes(feedItems.map((i) => i.id), uid);
      }
    } catch (err) {
      console.error('[fetchAll]', err);
    }
  }, [selectedDistrict, refreshUser, loadMutuals, fetchLikes]);

  // ── Initial load ──
  React.useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  // ── Register push token and persist it to profiles ────────────────────────
  useEffect(() => {
    if (!userId) return;
    registerForPushNotificationsAsync().then(async (token) => {
      if (!token) return;
      try {
        await supabase
          .from('profiles')
          .upsert({ id: userId, push_token: token }, { onConflict: 'id' });
      } catch (err) {
        // Non-critical — silently ignore
        console.warn('[PushToken] upsert failed:', err);
      }
    });
  }, [userId]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }

  // ── Like toggle ───────────────────────────────────────────────────────────
  const handleFeedLike = useCallback(async (postId: string) => {
    if (!userId) {
      Alert.alert('Giriş Yapın', 'Beğenmek için giriş yapmalısınız.', [
        { text: 'Giriş Yap', onPress: () => router.push('/auth') },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
      return;
    }

    const current = likeStates[postId] ?? { count: 0, likedByMe: false };
    const nowLiked = !current.likedByMe;

    setLikeStates((prev) => ({
      ...prev,
      [postId]: { count: nowLiked ? current.count + 1 : Math.max(current.count - 1, 0), likedByMe: nowLiked },
    }));

    try {
      if (nowLiked) {
        await supabase.from('likes').insert({ post_id: postId, user_id: userId });
      } else {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      }
    } catch {
      setLikeStates((prev) => ({ ...prev, [postId]: current }));
      Alert.alert('Hata', 'Beğeni işlemi başarısız oldu, lütfen tekrar deneyin.');
    }
  }, [userId, likeStates, router]);

  // ── Delete post (Admin or own post) ──────────────────────────────────────
  const handleDeletePost = useCallback((postId: string) => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gönderiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            // ── Optimistic UI: remove immediately ──
            setFeed((prev) => prev.filter((i) => i.id !== postId));

            const { error } = await supabase
              .from('feed')
              .delete()
              .eq('id', postId);

            if (error) {
              console.error('[DeletePost]', error.message);
              // Restore feed from server on failure
              fetchAll();
              Alert.alert('Hata', 'Gönderi silinemedi, lütfen tekrar deneyin.');
            }
          },
        },
      ]
    );
  }, [fetchAll]);

  // ── Open story viewer ──
  function openViewer(storiesSubset: EnrichedStory[], index: number) {
    const s = storiesSubset[index];
    if (s) viewedIds.current.add(s.id);
    setViewerStories(storiesSubset);
    setViewerIndex(index);
    setViewerVisible(true);
  }

  // ── Category + feed filtering ─────────────────────────────────────────────
  const filteredFeed = (() => {
    if (activeFilter === 'Arkadaşlar') {
      // Only show posts from mutual friends
      return feed.filter((item) =>
        item.category === 'Arkadaşlar' &&
        item.authorId !== null &&
        (mutualIds.has(item.authorId) || item.authorId === userId)
      );
    }
    return feed.filter((item) =>
      item.category.toLowerCase().includes(activeFilter.toLowerCase())
    );
  })();

  // ── Filtered stories ──────────────────────────────────────────────────────
  const filteredStories = (() => {
    // All stories visible except Arkadaşlar — those only for mutual friends
    return stories.filter((s) => {
      if (s.category === 'Arkadaşlar') {
        return s.user_id !== null && (mutualIds.has(s.user_id) || s.user_id === userId);
      }
      return true;
    });
  })();

  // ─── Arkadaşlar empty state check ─────────────────────────────────────────
  const arkadaşlarStoriesCount = filteredStories.filter((s) => s.category === 'Arkadaşlar').length;
  const showArkadaşlarEmpty    = (activeFilter as string) === 'Arkadaşlar' && filteredFeed.length === 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={OLIVE} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── Story viewer ── */}
      <StoryViewer
        stories={viewerStories}
        initialIndex={viewerIndex}
        district={selectedDistrict}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />

      {/* ── District Dropdown ── */}
      <DropdownModal
        visible={districtDropdownOpen}
        items={DISTRICTS}
        selected={selectedDistrict}
        onSelect={(d) => setSelectedDistrict(d as District)}
        onClose={() => setDistrictDropdownOpen(false)}
        title="Bölge Seç"
      />

      {/* ── Sticky Header: [+] | [District ▾] | [🔍][🔔] ── */}
      <View style={styles.header}>
        {/* Left: Create Post "+" */}
        <TouchableOpacity
          style={styles.headerAddBtn}
          activeOpacity={0.75}
          onPress={() => handleCreatePost(router)}
        >
          <Ionicons name="add-outline" size={26} color="#334155" />
        </TouchableOpacity>

        {/* Center: District Selector — absolutely positioned for true centering */}
        <View style={styles.headerCenter} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.locationBtn}
            activeOpacity={0.75}
            onPress={() => setDistrictDropdownOpen(true)}
          >
            <Ionicons name="location-outline" size={16} color={OLIVE} />
            <Text style={styles.locationText}>{selectedDistrict}</Text>
            <Ionicons name="chevron-down" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Right: Search + Notifications */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.headerIconWrap}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search-outline" size={22} color="#334155" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.headerIconWrap}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#334155" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sticky 4-Segment Tabs: Yerel · Ulusal · Sosyal · Arkadaşlar ── */}
      <View style={styles.segmentBar}>
        {SEGMENT_CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.segmentTab, isActive && styles.segmentTabActive]}
              activeOpacity={0.75}
              onPress={() => setActiveFilter(cat)}
            >
              <Text
                style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}
                numberOfLines={1}
              >
                {cat}
              </Text>
              {isActive && <View style={styles.segmentTabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Main Scroll ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={OLIVE} colors={[OLIVE]} />}
      >
        {/* ─ Stories Row ─ */}
        <View style={styles.storiesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
            {isAdmin && <AddStoryButton onPress={() => router.push('/create-story')} />}

            {filteredStories.length === 0 && activeFilter === 'Arkadaşlar' ? (
              /* Arkadaşlar empty state: show "Arkadaş Ekle" button */
              <TouchableOpacity
                style={styles.addFriendStoryBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/search')}
              >
                <View style={styles.addFriendStoryCircle}>
                  <Ionicons name="person-add-outline" size={26} color={OLIVE} />
                </View>
                <Text style={styles.addFriendStoryLabel}>Arkadaş Ekle</Text>
              </TouchableOpacity>
            ) : filteredStories.length === 0 ? (
              <View style={styles.noStoriesHint}>
                <Ionicons name="images-outline" size={20} color="#CBD5E1" />
                <Text style={styles.noStoriesText}>Hikaye yok</Text>
              </View>
            ) : (
              filteredStories.map((story, i) => (
                <StoryItem
                  key={story.id}
                  story={story}
                  viewed={viewedIds.current.has(story.id)}
                  onPress={() => openViewer(filteredStories, i)}
                />
              ))
            )}

            {/* Arkadaşlar stories section: show "Arkadaş Ekle" chip if 0 friend stories */}
            {activeFilter !== 'Arkadaşlar' && arkadaşlarStoriesCount === 0 && filteredStories.length > 0 && (
              <TouchableOpacity
                style={styles.storyItem}
                activeOpacity={0.75}
                onPress={() => router.push('/search')}
              >
                <View style={[styles.storyRing, styles.addFriendRing]}>
                  <View style={styles.filterInner}>
                    <Ionicons name="person-add-outline" size={22} color="#94A3B8" />
                  </View>
                </View>
                <Text style={[styles.storyLabel, { color: '#94A3B8' }]}>Arkadaş</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ─ Feed ─ */}
        <View style={styles.feedSection}>
          <View style={styles.feedList}>
            {showArkadaşlarEmpty ? (
              /* Arkadaşlar category empty state */
              <View style={styles.arkEmptyState}>
                <Ionicons name="heart-outline" size={48} color="#CBD5E1" />
                <Text style={styles.arkEmptyTitle}>Arkadaş Gönderisi Yok</Text>
                <Text style={styles.arkEmptySubtitle}>
                  Arkadaşlarınızın paylaşımlarını görmek için arkadaş ekleyin.
                </Text>
                <TouchableOpacity
                  style={styles.arkEmptyBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push('/search')}
                >
                  <Ionicons name="person-add-outline" size={16} color="#fff" />
                  <Text style={styles.arkEmptyBtnText}>Arkadaş Ekle</Text>
                </TouchableOpacity>
              </View>
            ) : filteredFeed.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="newspaper-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>{selectedDistrict} için henüz gönderi yok.</Text>
              </View>
            ) : (
              filteredFeed.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  likeState={likeStates[item.id] ?? { count: 0, likedByMe: false }}
                  canDelete={
                    isAdmin ||
                    userRole === 'admin' ||
                    (userId !== null && item.authorId === userId)
                  }
                  onPress={() =>
                    router.push({ pathname: '/post/[id]', params: { id: item.id, postData: JSON.stringify(item) } })
                  }
                  onLike={() => handleFeedLike(item.id)}
                  onAuthorPress={() => {
                    if (item.authorUsername) {
                      router.push({ pathname: '/user/[username]', params: { username: item.authorUsername } });
                    }
                  }}
                  onDelete={() => handleDeletePost(item.id)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  screen          : { flex: 1, backgroundColor: BG },

  // ── Header ──
  header: {
    backgroundColor: 'rgba(249,250,251,0.96)',
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  // "+" create post button (top-left)
  headerAddBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(77,124,15,0.08)',
  },
  // District selector — absolutely centered
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  locationBtn  : { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText : { fontSize: 15, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  headerRight  : { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIconWrap: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: RED, borderWidth: 1.5, borderColor: BG,
  },

  // ── 4-Segment Tabs ──
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249,250,251,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.8)',
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  segmentTabActive: {},
  segmentTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2.5,
    backgroundColor: OLIVE,
    borderRadius: 2,
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: -0.1,
  },
  segmentTabTextActive: {
    color: OLIVE,
    fontWeight: '700',
  },

  scroll: { flex: 1 },

  // ── Stories Row ──
  storiesSection: { paddingTop: 16, paddingBottom: 8 },
  storiesRow    : { paddingHorizontal: 20, gap: 16, alignItems: 'flex-start' },
  storyItem     : { alignItems: 'center', gap: 8, maxWidth: 72 },
  storyRing     : { width: 68, height: 68, borderRadius: 34, padding: 2.5 },
  storyRingViewed: { backgroundColor: '#E2E8F0' },
  storyInner    : { flex: 1, borderRadius: 32, borderWidth: 2, borderColor: BG, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  storyImage    : { width: '100%', height: '100%' },
  storyLabel    : { fontSize: 11, color: '#475569', fontWeight: '400', textAlign: 'center' },
  addStoryCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noStoriesHint : { alignItems: 'center', justifyContent: 'center', gap: 4, width: 68, paddingTop: 8 },
  noStoriesText : { fontSize: 10, color: '#CBD5E1', fontWeight: '400' },

  // Add friend story button
  addFriendStoryBtn   : { alignItems: 'center', gap: 8, maxWidth: 72 },
  addFriendStoryCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: `${OLIVE}10`,
    borderWidth: 1.5, borderColor: `${OLIVE}35`,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addFriendStoryLabel: { fontSize: 11, color: OLIVE, fontWeight: '500', textAlign: 'center' },

  // Add friend chip in stories row
  addFriendRing: { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterInner  : { flex: 1, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  // ── Dropdown ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 320,
    overflow: 'hidden', shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
  },
  dropdownTitle     : { fontSize: 13, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  dropdownItem      : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)' },
  dropdownItemLeft  : { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dropdownItemText  : { fontSize: 16, fontWeight: '400', color: '#1E293B' },
  dropdownItemActive: { fontWeight: '600', color: OLIVE },

  // ── Feed ──
  feedSection: { marginTop: 16, paddingHorizontal: 20 },
  feedList   : { gap: 14 },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },

  // ── Image with overlay ──
  feedImageWrap: {
    width: 92, height: 92,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#F1F5F9', flexShrink: 0,
  },
  feedImage: {
    width: 92, height: 92,
    borderRadius: 16, backgroundColor: '#F1F5F9',
  },
  feedImageFallback: { alignItems: 'center', justifyContent: 'center' },

  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  playCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Info Badge: compact pill at bottom-right corner of image ──
  imageBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageTimestamp: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.1,
  },
  imageSep: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '400',
    lineHeight: 13,
  },
  imageLikeCount: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: -0.2,
  },
  imageLikeCountActive: { color: '#FF6B8A' },

  // ── Card content ──
  feedContent: { flex: 1, paddingVertical: 1, gap: 4 },

  feedCategoryRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedCategoryLeft  : { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  feedCategory      : { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  mediaTypeBadge    : {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100,
  },
  mediaTypeBadgeText: { fontSize: 10, fontWeight: '500' },
  deleteBtn: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
    marginLeft: 4,
  },

  feedTitle      : { fontSize: 13, fontWeight: '600', color: '#1E293B', lineHeight: 18, letterSpacing: -0.15 },
  feedDescription: { fontSize: 12, color: '#94A3B8', fontWeight: '400', lineHeight: 17 },

  // ── Author row ──
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  authorText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  authorRoleBadge: {
    borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2,
  },
  authorRoleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },

  // Empty states
  emptyState    : { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyStateText: { fontSize: 14, color: '#CBD5E1', fontWeight: '400', textAlign: 'center' },

  // Arkadaşlar empty
  arkEmptyState   : { paddingVertical: 56, alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  arkEmptyTitle   : { fontSize: 18, fontWeight: '600', color: '#94A3B8', letterSpacing: -0.3 },
  arkEmptySubtitle: { fontSize: 14, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },
  arkEmptyBtn     : {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: OLIVE, borderRadius: 100,
    paddingHorizontal: 20, paddingVertical: 11,
    marginTop: 4,
    shadowColor: OLIVE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  arkEmptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
