import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ADMIN_EMAIL, supabase } from '@/lib/supabase';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE        = '#4D7C0F';
const BG           = '#F9FAFB';
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ────────────────────────────────────────────────────────────────────
type PostDetail = {
  id: string;
  image: string | null;
  media_type: string | null;
  category: string;
  category_color: string;
  title: string;
  description: string;
  created_at: string;
};

type Comment = {
  id: string;
  user_id: string | null;
  user_email: string;
  username  : string | null;   // from joined profiles
  avatar_url: string | null;   // from joined profiles
  content: string;
  created_at: string;
  isPending?: boolean; // Task 3: optimistic flag
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Turkish relative time — falls back to full date for posts older than 7 days. */
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const now  = new Date();
    const date = new Date(iso);
    const secs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secs < 60)   return 'Az önce';
    const mins = Math.floor(secs / 60);
    if (mins  < 60)  return `${mins} dakika önce`;
    const hrs  = Math.floor(mins / 60);
    if (hrs   < 24)  return `${hrs} saat önce`;
    const days = Math.floor(hrs / 24);
    if (days  < 7)   return `${days} gün önce`;

    // Older → show formatted date (e.g. "8 Mart 2026")
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return ''; }
}

function formatCommentTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

function shortEmail(email: string): string {
  if (email.length <= 22) return email;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 8)}…@${domain}`;
}

/** Display name for a comment: prefer @username, fallback to short email */
function commentDisplayName(c: Comment): string {
  if (c.username) return `@${c.username}`;
  return shortEmail(c.user_email ?? '?');
}

function isVideoMedia(post: PostDetail): boolean {
  if (post.media_type === 'video') return true;
  if (post.image) {
    const ext = post.image.split('?')[0].split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'mov' || ext === 'm4v' || ext === 'webm' || ext === 'avi';
  }
  return false;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PostDetailScreen() {
  const { id, postData } = useLocalSearchParams<{ id: string; postData?: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // ── Post ── initialised instantly from navigation params ──
  const [post, setPost] = useState<PostDetail | null>(() => {
    if (!postData) return null;
    try {
      const p = JSON.parse(String(postData));
      return {
        id:             p.id,
        image:          p.image ?? null,
        media_type:     p.media_type ?? null,
        category:       p.category,
        // FeedItem uses camelCase `categoryColor`; PostDetail uses `category_color`
        category_color: p.category_color ?? p.categoryColor ?? OLIVE,
        title:          p.title,
        description:    p.description,
        // FeedItem uses camelCase `createdAt`; fall back for both key shapes
        created_at:     p.created_at ?? p.createdAt ?? '',
      } as PostDetail;
    } catch { return null; }
  });
  const [imageError, setImageError] = useState(false);

  // ── Full-screen image modal ──
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // ── Auth ──
  const [userId,      setUserId     ] = useState<string | null>(null);
  const [userEmail,   setUserEmail  ] = useState<string>('');
  const [myUsername,  setMyUsername ] = useState<string>('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  // ── Likes ──
  const [likeCount,        setLikeCount       ] = useState(0);
  const [likedByMe,        setLikedByMe       ] = useState(false);
  const [likingInProgress, setLikingInProgress] = useState(false);

  // ── Comments ──
  const [comments,        setComments       ] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText,     setCommentText    ] = useState('');
  const [sending,         setSending        ] = useState(false);

  // ── Task 4: Like button micro-animation ──
  const likeScale = useSharedValue(1);
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  function triggerLikeAnimation(isLiking: boolean) {
    // Pop-up on like, gentle shrink on unlike
    if (isLiking) {
      likeScale.value = withSequence(
        withSpring(1.4, { damping: 4, stiffness: 500 }),
        withSpring(1,   { damping: 7, stiffness: 300 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      likeScale.value = withSequence(
        withTiming(0.85, { duration: 80 }),
        withSpring(1,    { damping: 7, stiffness: 300 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  // ── Fetch current user ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? '');
        // Load username + avatar from profiles
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        setMyUsername(prof?.username ?? user.email?.split('@')[0] ?? '');
        setMyAvatarUrl(prof?.avatar_url ?? null);
      }
    })();
  }, []);

  // ── Background refresh: silently update post from server ──
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('feed')
        .select('id, image, media_type, category, category_color, title, description, created_at')
        .eq('id', id)
        .single();
      if (error) console.error('[PostDetail] fetch error:', error.message);
      if (data)  setPost(data as PostDetail);
    })();
  }, [id]);

  // ── Fetch likes count + did current user like? ──
  const fetchLikes = useCallback(async () => {
    if (!id) return;
    const { count, error: countErr } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id);
    if (countErr) console.error('[Likes] count error:', countErr.message);
    else          setLikeCount(count ?? 0);

    if (userId) {
      const { data: myLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      setLikedByMe(!!myLike);
    }
  }, [id, userId]);

  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  // ── Fetch comments (with username + avatar_url from profiles join) ──
  const fetchComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, user_email, content, created_at, profiles:user_id(username, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true });
    if (error) console.error('[Comments] fetch error:', error.message);
    if (data) {
      const mapped: Comment[] = (data as Array<{
        id: string; user_id: string | null; user_email: string;
        content: string; created_at: string;
        profiles: { username: string; avatar_url: string | null } | null;
      }>).map((row) => ({
        id        : row.id,
        user_id   : row.user_id,
        user_email: row.user_email,
        username  : row.profiles?.username ?? null,
        avatar_url: row.profiles?.avatar_url ?? null,
        content   : row.content,
        created_at: row.created_at,
      }));
      setComments(mapped);
    }
    setCommentsLoading(false);
  }, [id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // ── Task 2: Real-time comment subscription ──────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`post-comments:${id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'comments',
          filter: `post_id=eq.${id}`,
        },
        (payload) => {
          const incoming = payload.new as Comment;
          // Deduplicate: skip if we already have this ID (covers our own optimistic → fetchComments flow)
          setComments((prev) => {
            if (prev.some((c) => c.id === incoming.id)) return prev;
            return [...prev, { ...incoming, isPending: false }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // ── Task 1: Optimistic Like toggle ─────────────────────────────────────────
  async function handleLike() {
    // userId is only null for unauthenticated guests; admin is always logged in
    if (!userId) {
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
    if (likingInProgress) return;

    // Snapshot for rollback
    const wasLiked       = likedByMe;
    const prevLikeCount  = likeCount;

    // Optimistic update + animation (Task 4)
    const nowLiked = !wasLiked;
    setLikedByMe(nowLiked);
    setLikeCount((c) => wasLiked ? c - 1 : c + 1);
    triggerLikeAnimation(nowLiked);
    setLikingInProgress(true);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: id, user_id: userId });
        if (error) throw error;
      }
    } catch (err: unknown) {
      // Rollback
      setLikedByMe(wasLiked);
      setLikeCount(prevLikeCount);
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Hata oluştu';
      console.error('[Likes] toggle error:', msg);
      Alert.alert('Hata', msg);
    } finally {
      setLikingInProgress(false);
    }
  }

  // ── Task 3: Optimistic comment submit ───────────────────────────────────────
  async function handleSendComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    if (!userId) {
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

    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const tempId = `optimistic-${Date.now()}`;
    const optimisticComment: Comment = {
      id        : tempId,
      user_id   : userId,
      user_email: userEmail,
      username  : myUsername || null,
      avatar_url: myAvatarUrl,
      content   : trimmed,
      created_at: new Date().toISOString(),
      isPending : true,         // ← visual dimming while in-flight
    };

    // Optimistic append — clear input immediately for snappy UX
    setComments((prev) => [...prev, optimisticComment]);
    setCommentText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { error } = await supabase.from('comments').insert({
        post_id   : id,
        user_id   : userId,
        user_email: userEmail,
        content   : trimmed,
      });
      if (error) throw error;

      // Replace optimistic entry with confirmed server data.
      // fetchComments sets isPending:undefined (falsy) for all rows.
      await fetchComments();
    } catch (err: unknown) {
      // Rollback: remove the ghost comment, restore input text
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentText(trimmed);
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Yorum gönderilemedi';
      console.error('[Comment] insert error:', msg);
      Alert.alert('Hata', msg);
    } finally {
      setSending(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render guards
  // ─────────────────────────────────────────────────────────────────────────────
  if (!post) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Ionicons name="alert-circle-outline" size={48} color="#CBD5E1" />
        <Text style={styles.notFoundText}>Gönderi bulunamadı</Text>
        <TouchableOpacity style={styles.backPillBtn} activeOpacity={0.8} onPress={() => router.back()}>
          <Text style={styles.backPillText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isVideo   = isVideoMedia(post);
  const hasMedia  = !!post.image && !imageError;
  const showVideo = hasMedia && isVideo;
  const showImage = hasMedia && !isVideo;

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.75}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Gönderi Detayı</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Scrollable body ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─ Hero Media ─ */}
          {showVideo ? (
            <Video
              source={{ uri: post.image! }}
              style={styles.heroImage}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              isLooping
              shouldPlay={false}
              onError={() => setImageError(true)}
            />
          ) : showImage ? (
            <TouchableOpacity activeOpacity={0.95} onPress={() => setImageModalVisible(true)}>
              <Image
                source={{ uri: post.image! }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                onError={() => setImageError(true)}
              />
              <View style={styles.zoomHintBadge}>
                <Ionicons name="expand-outline" size={14} color="#fff" />
                <Text style={styles.zoomHintText}>Büyütmek için dokun</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#CBD5E1" />
            </View>
          )}

          {/* ─ Content Card ─ */}
          <View style={styles.contentCard}>
            <View style={[styles.categoryBadge, { backgroundColor: `${post.category_color ?? OLIVE}18` }]}>
              <Text style={[styles.categoryText, { color: post.category_color ?? OLIVE }]}>
                {post.category}
              </Text>
            </View>
            <Text style={styles.title}>{post.title}</Text>
            <Text style={styles.date}>{timeAgo(post.created_at)}</Text>
            <View style={styles.divider} />
            <Text style={styles.description}>{post.description}</Text>
          </View>

          {/* ─ Like + Comment count strip ─ */}
          <View style={styles.likeStrip}>
            {/* Like button with count */}
            <Animated.View style={likeAnimStyle}>
              <TouchableOpacity
                style={[styles.likeBtn, likedByMe && styles.likeBtnActive]}
                activeOpacity={0.8}
                onPress={handleLike}
                disabled={likingInProgress}
              >
                {likingInProgress ? (
                  <ActivityIndicator size="small" color={likedByMe ? '#E11D48' : '#64748B'} />
                ) : (
                  <Ionicons
                    name={likedByMe ? 'heart' : 'heart-outline'}
                    size={22}
                    color={likedByMe ? '#E11D48' : '#64748B'}
                  />
                )}
                <Text style={[styles.likeBtnText, likedByMe && styles.likeBtnTextActive]}>
                  {likeCount}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Comment count chip — read-only, only visible on this page */}
            <View style={styles.commentCountChip}>
              <Ionicons name="chatbubble-outline" size={20} color="#64748B" />
              <Text style={styles.commentCountText}>{comments.length}</Text>
            </View>
          </View>

          {/* ─ Comments Section ─ */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>
              Yorumlar
              {comments.length > 0 && (
                <Text style={styles.commentsCount}> ({comments.length})</Text>
              )}
            </Text>

            {commentsLoading ? (
              <ActivityIndicator size="small" color={OLIVE} style={{ marginTop: 16 }} />
            ) : comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyCommentsText}>
                  Henüz yorum yok. İlk yorumu sen yap!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map((c) => {
                  const displayName = commentDisplayName(c);
                  const initial = (c.username?.[0] ?? c.user_email?.[0] ?? '?').toUpperCase();
                  return (
                    // Task 3: dim the row while isPending
                    <View key={c.id} style={[styles.commentRow, c.isPending && styles.commentRowPending]}>
                      <TouchableOpacity
                        style={styles.commentAvatar}
                        activeOpacity={c.username ? 0.7 : 1}
                        onPress={() => {
                          if (c.username) {
                            router.push({ pathname: '/user/[username]', params: { username: c.username } });
                          }
                        }}
                      >
                        {c.avatar_url ? (
                          <Image
                            source={{ uri: c.avatar_url }}
                            style={styles.commentAvatarImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <Text style={styles.commentAvatarLetter}>{initial}</Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.commentBubble}>
                        <View style={styles.commentMeta}>
                          <TouchableOpacity
                            activeOpacity={c.username ? 0.7 : 1}
                            onPress={() => {
                              if (c.username) {
                                router.push({ pathname: '/user/[username]', params: { username: c.username } });
                              }
                            }}
                          >
                            <Text style={styles.commentEmail}>{displayName}</Text>
                          </TouchableOpacity>
                          {c.isPending ? (
                            <Text style={styles.commentSending}>Gönderiliyor…</Text>
                          ) : (
                            <Text style={styles.commentTime}>{formatCommentTime(c.created_at)}</Text>
                          )}
                        </View>
                        <Text style={styles.commentContent}>{c.content}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Sticky Comment Input Bar ── */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.commentInput}
            placeholder="Yorum yaz..."
            placeholderTextColor="#94A3B8"
            value={commentText}
            onChangeText={setCommentText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSendComment}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!commentText.trim() || sending) && styles.sendBtnDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleSendComment}
            disabled={!commentText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Full-Screen Image Modal with Pinch-to-Zoom ── */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom
          >
            <Image
              source={{ uri: post.image ?? '' }}
              style={styles.modalImage}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalCloseBtn, { top: insets.top + 12 }]}
            activeOpacity={0.8}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '400',
  },
  backPillBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: OLIVE,
    borderRadius: 100,
  },
  backPillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
  },

  scroll: {
    flex: 1,
  },

  // ── Hero Media ──
  heroImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 9 / 16,   // portrait 9:16 — respects natural media aspect
    backgroundColor: '#0F172A',
  },
  heroPlaceholder: {
    width: SCREEN_WIDTH,
    aspectRatio: 9 / 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  zoomHintText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '400',
  },

  // ── Content Card ──
  contentCard: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '400',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(226,232,240,0.8)',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 26,
    fontWeight: '400',
  },

  // ── Like + Comment Strip ──
  likeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.8)',
  },
  commentCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  commentCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    minWidth: 16,
    textAlign: 'center',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  likeBtnActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  likeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    minWidth: 16,
    textAlign: 'center',
  },
  likeBtnTextActive: {
    color: '#E11D48',
  },

  // ── Comments Section ──
  commentsSection: {
    marginHorizontal: 20,
    marginTop: 28,
    paddingBottom: 8,
  },
  commentsSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  commentsCount: {
    color: '#94A3B8',
    fontWeight: '400',
    fontSize: 15,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    textAlign: 'center',
  },
  commentsList: {
    gap: 12,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  // Task 3: dimmed while optimistic / in-flight
  commentRowPending: {
    opacity: 0.5,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${OLIVE}22`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  commentAvatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: OLIVE,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: '0px 1px 4px rgba(0,0,0,0.03)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
    }),
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: OLIVE,
    flex: 1,
  },
  commentTime: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '400',
    marginLeft: 8,
  },
  commentSending: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '400',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  commentContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '400',
  },

  // ── Input Bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.8)',
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0px -3px 10px rgba(0,0,0,0.04)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.04, shadowRadius: 10 },
    }),
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OLIVE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },

  // ── Full-Screen Image Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  modalScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 9 / 16,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
