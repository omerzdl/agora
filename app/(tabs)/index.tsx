import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ADMIN_EMAIL, supabase } from '@/lib/supabase';
import { useDistrict } from '@/lib/DistrictContext';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#22D3EE';
const BG    = '#0D0F1A';

// ─── Category Config ─────────────────────────────────────────────────────────
// Segment tabs: Yerel · Ulusal
const SEGMENT_CATEGORIES = ['Yerel', 'Ulusal'] as const;
type SegmentCategory = (typeof SEGMENT_CATEGORIES)[number];

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

// ─── Push notification token registration ─────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  // expo-notifications push token listeners are not fully supported on web.
  // Avoid registering on web to prevent noisy warnings and no-op listeners.
  if (Platform.OS === 'web') return null;

  // Lazy-load to avoid expo-notifications side effects on web.
  const Notifications = await import('expo-notifications');

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
  const router = useRouter();

  const { selectedDistrict } = useDistrict();

  const [activeFilter, setActiveFilter] = useState<SegmentCategory>('Yerel');

  // ── Feed ──
  const [feed,       setFeed      ] = useState<FeedItem[]>([]);
  const [loading,    setLoading   ] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Auth ──
  const [userId,     setUserId    ] = useState<string | null>(null);
  const [isAdmin,    setIsAdmin   ] = useState(false);
  const [userRole,   setUserRole  ] = useState<string | null>(null);

  // ── Like states ──
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});


  // ── Refresh user (auth + role) ────────────────────────────────────────────
  const refreshUser = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setUserId(uid);
    setIsAdmin((user?.email ?? '').toLowerCase() === ADMIN_EMAIL.toLowerCase());

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
      const feedRes = await supabase
        .from('feed')
        .select('id, image, media_type, category, category_color, title, description, created_at, user_id, profiles(username, role)')
        .eq('district', selectedDistrict)
        .order('created_at', { ascending: false });

      if (feedRes.error)  console.error('[feed]',    feedRes.error.message);

      const feedItems = feedRes.data ? (feedRes.data as FeedRow[]).map(mapFeed) : [];
      setFeed(feedItems);

      if (feedItems.length > 0) {
        await fetchLikes(feedItems.map((i) => i.id), uid);
      }
    } catch (err) {
      console.error('[fetchAll]', err);
    }
  }, [selectedDistrict, refreshUser, fetchLikes]);

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

  // ── Category + feed filtering ─────────────────────────────────────────────
  const filteredFeed = (() => {
    return feed.filter((item) =>
      item.category.toLowerCase().includes(activeFilter.toLowerCase())
    );
  })();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={OLIVE} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* ── Sticky 2-Segment Tabs: Yerel · Ulusal ── */}
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
        {/* ─ Feed ─ */}
        <View style={styles.feedSection}>
          <View style={styles.feedList}>
            {filteredFeed.length === 0 ? (
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

  // ── 2-Segment Tabs ──
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16,21,36,0.78)',
    borderBottomWidth: 0,
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
    color: '#8EA4C6',
    letterSpacing: -0.1,
  },
  segmentTabTextActive: {
    color: OLIVE,
    fontWeight: '700',
  },

  scroll: { flex: 1 },

  // ── Feed ──
  feedSection: { marginTop: 12, paddingHorizontal: 20 },
  feedList   : { gap: 14 },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    backgroundColor: 'rgba(23,31,51,0.62)',
    borderRadius: 20,
    borderWidth: 0,
    elevation: 0,
    ...Platform.select({
      web: { boxShadow: '0px 14px 28px rgba(0,0,0,0.28)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18 },
    }),
  },

  // ── Image with overlay ──
  feedImageWrap: {
    width: 92, height: 92,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(42,55,86,0.7)', flexShrink: 0,
  },
  feedImage: {
    width: 92, height: 92,
    borderRadius: 16, backgroundColor: 'rgba(42,55,86,0.7)',
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
    backgroundColor: 'rgba(10,14,24,0.66)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageTimestamp: {
    fontSize: 10, fontWeight: '600',
    color: '#D7E3F7',
    letterSpacing: 0.1,
  },
  imageSep: {
    fontSize: 9,
    color: '#88A0C4',
    fontWeight: '400',
    lineHeight: 13,
  },
  imageLikeCount: {
    fontSize: 10, fontWeight: '700',
    color: '#E8F2FF',
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
    backgroundColor: 'rgba(37,49,75,0.65)',
  },

  feedTitle      : { fontSize: 13, fontWeight: '700', color: '#EDF4FF', lineHeight: 18, letterSpacing: -0.15 },
  feedDescription: { fontSize: 12, color: '#A1B5D4', fontWeight: '400', lineHeight: 17 },

  // ── Author row ──
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  authorText: { fontSize: 11, color: '#93A9C8', fontWeight: '500' },
  authorRoleBadge: {
    borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2,
  },
  authorRoleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },

  // Empty states
  emptyState    : { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyStateText: { fontSize: 14, color: '#92A8C8', fontWeight: '400', textAlign: 'center' },

});
