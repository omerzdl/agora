import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ADMIN_EMAIL, supabase } from '@/lib/supabase';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';

// ─── Types ────────────────────────────────────────────────────────────────────
type UserProfile = {
  id          : string;
  username    : string;
  full_name   : string | null;
  bio         : string | null;
  avatar_url  : string | null;
  district    : string | null;
  email       : string | null;
  phone_number: string | null;
  show_email  : boolean;
  show_phone  : boolean;
  role        : string | null;
};

type Friend = {
  id        : string;
  username  : string;
  full_name : string | null;
  avatar_url: string | null;
};

// Friendship state with viewer
type FriendshipState = 'none' | 'following' | 'mutual' | 'loading';

// ─── Role badge ───────────────────────────────────────────────────────────────
// Admin  → Gold/Red  shield-checkmark
// Editör → Blue tick checkmark-circle
// Pro    → Green tick checkmark-circle
function getRoleConfig(role: string | null, email: string | null): {
  label: string; bg: string; color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
} | null {
  if (email === ADMIN_EMAIL || role === 'admin')
    return { label: 'Admin',  bg: '#FFF7ED', color: '#C2410C', icon: 'shield-checkmark' };
  if (role === 'editor')
    return { label: 'Editör', bg: '#EFF6FF', color: '#1D4ED8', icon: 'checkmark-circle' };
  if (role === 'pro')
    return { label: 'Pro',    bg: '#F0FDF4', color: '#15803D', icon: 'checkmark-circle' };
  return null;
}

function getInitials(fullName: string | null, username: string) {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

// ─── Friends Modal ────────────────────────────────────────────────────────────
function FriendsModal({
  visible, friends, loading, onClose, onUserPress,
}: {
  visible: boolean; friends: Friend[]; loading: boolean;
  onClose: () => void; onUserPress: (username: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={fmSt.overlay}>
        <View style={fmSt.sheet}>
          <View style={fmSt.handle} />
          <View style={fmSt.header}>
            <Text style={fmSt.title}>Arkadaşlar</Text>
            <TouchableOpacity style={fmSt.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={OLIVE} style={{ marginTop: 40 }} />
          ) : friends.length === 0 ? (
            <View style={fmSt.empty}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={fmSt.emptyText}>Henüz arkadaş yok</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              ItemSeparatorComponent={() => <View style={fmSt.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={fmSt.row}
                  activeOpacity={0.75}
                  onPress={() => { onClose(); onUserPress(item.username); }}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={fmSt.avatar} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[fmSt.avatar, fmSt.avatarFB]}>
                      <Text style={fmSt.initials}>{getInitials(item.full_name, item.username)}</Text>
                    </View>
                  )}
                  <View style={fmSt.info}>
                    <Text style={fmSt.name}>{item.full_name ?? item.username}</Text>
                    <Text style={fmSt.uname}>@{item.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const fmSt = StyleSheet.create({
  overlay : { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet   : { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: 360, maxHeight: '80%', paddingBottom: 24 },
  handle  : { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header  : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title   : { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.4 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  empty   : { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 15, color: '#94A3B8' },
  row     : { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  sep     : { height: 1, backgroundColor: 'rgba(226,232,240,0.6)' },
  avatar  : { width: 46, height: 46, borderRadius: 23 },
  avatarFB: { backgroundColor: `${OLIVE}22`, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '700', color: OLIVE },
  info    : { flex: 1 },
  name    : { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  uname   : { fontSize: 13, color: '#94A3B8', marginTop: 1 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile,          setProfile         ] = useState<UserProfile | null>(null);
  const [loading,          setLoading         ] = useState(true);
  const [currentUserId,    setCurrentUserId   ] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole,  setCurrentUserRole ] = useState<string | null>(null);
  const [friendship,       setFriendship      ] = useState<FriendshipState>('none');
  const [friendCount,      setFriendCount     ] = useState(0);
  const [friends,          setFriends         ] = useState<Friend[]>([]);
  const [friendsModal,     setFriendsModal    ] = useState(false);
  const [friendsLoading,   setFriendsLoading  ] = useState(false);
  const [roleUpdating,     setRoleUpdating    ] = useState(false);

  // ── In-app toast ──────────────────────────────────────────────────────────
  const [toastMsg,     setToastMsg    ] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTransY  = useRef(new Animated.Value(16)).current;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    toastOpacity.setValue(0);
    toastTransY.setValue(16);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(toastTransY,  { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(toastTransY,  { toValue: 12, duration: 300, useNativeDriver: true }),
        ]).start(() => setToastVisible(false));
      }, 2200);
    });
  }, [toastOpacity, toastTransY]);

  // ── Load current user + target profile ───────────────────────────────────
  const load = useCallback(async () => {
    if (!username) return;

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);
    setCurrentUserEmail(user?.email ?? null);

    // Fetch the viewing user's own role (for admin panel visibility)
    if (user?.id) {
      const { data: myProf } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setCurrentUserRole(myProf?.role ?? null);
    }

    // Load target profile
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, bio, avatar_url, district, email, phone_number, show_email, show_phone, role')
      .eq('username', String(username).toLowerCase())
      .maybeSingle();

    if (error) console.error('[UserProfile] error:', error.message);

    if (!data) { setLoading(false); return; }

    setProfile(data as UserProfile);

    // Determine friendship state
    if (user?.id && user.id !== data.id) {
      await checkFriendship(user.id, data.id);
    }

    // Load friend count for this user
    await loadFriendCount(data.id);
    setLoading(false);
  }, [username]);

  const checkFriendship = async (myId: string, theirId: string) => {
    // Check if I follow them
    const { data: iFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', myId)
      .eq('following_id', theirId)
      .maybeSingle();

    if (!iFollow) { setFriendship('none'); return; }

    // Check if they follow me (mutual)
    const { data: theyFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', theirId)
      .eq('following_id', myId)
      .maybeSingle();

    setFriendship(theyFollow ? 'mutual' : 'following');
  };

  const loadFriendCount = async (uid: string) => {
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', uid);

    const followingIds = (followingData ?? []).map((r: { following_id: string }) => r.following_id);
    if (followingIds.length === 0) { setFriendCount(0); return; }

    const { data: mutual } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', uid)
      .in('follower_id', followingIds);

    setFriendCount(mutual?.length ?? 0);
  };

  useEffect(() => { load(); }, [load]);

  // ── Add / Remove Friend ───────────────────────────────────────────────────
  async function handleFriendAction() {
    if (!currentUserId) {
      Alert.alert('Giriş Gerekli', 'Arkadaş eklemek için giriş yapmanız gerekiyor.', [
        { text: 'Giriş Yap', onPress: () => router.push('/auth') },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
      return;
    }
    if (!profile) return;

    if (friendship === 'none') {
      setFriendship('loading');
      try {
        // Follow them
        const { error } = await supabase.from('follows').insert({
          follower_id : currentUserId,
          following_id: profile.id,
        });
        if (error) throw error;

        // Send in-app notification to the target user
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUserId)
          .maybeSingle();

        const senderUsername = myProfile?.username ?? 'Biri';
        await supabase.from('notifications').insert({
          user_id  : profile.id,
          sender_id: currentUserId,
          type     : 'friend_request',
          message  : `${senderUsername} seni arkadaş olarak ekledi`,
          read     : false,
        });

        // Re-check friendship (they might already follow you)
        await checkFriendship(currentUserId, profile.id);
        await loadFriendCount(profile.id);
      } catch (err) {
        console.error('[Follow]', err);
        Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
        setFriendship('none');
      }
    } else if (friendship === 'following' || friendship === 'mutual') {
      Alert.alert(
        'Takibi Bırak',
        `@${profile.username} kullanıcısını takip etmeyi bırakmak istiyor musunuz?`,
        [
          {
            text: 'Evet', style: 'destructive', onPress: async () => {
              setFriendship('loading');
              try {
                await supabase.from('follows').delete()
                  .eq('follower_id', currentUserId)
                  .eq('following_id', profile.id);
                setFriendship('none');
                await loadFriendCount(profile.id);
              } catch {
                Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
                await checkFriendship(currentUserId, profile.id);
              }
            },
          },
          { text: 'Vazgeç', style: 'cancel' },
        ]
      );
    }
  }

  const loadFriendsModal = async () => {
    if (!profile) return;
    setFriendsLoading(true);

    const { data: followingData } = await supabase
      .from('follows').select('following_id').eq('follower_id', profile.id);

    const followingIds = (followingData ?? []).map((r: { following_id: string }) => r.following_id);
    if (followingIds.length === 0) { setFriends([]); setFriendsLoading(false); return; }

    const { data: mutualData } = await supabase
      .from('follows').select('follower_id').eq('following_id', profile.id).in('follower_id', followingIds);

    const mutualIds = (mutualData ?? []).map((r: { follower_id: string }) => r.follower_id);
    if (mutualIds.length === 0) { setFriends([]); setFriendsLoading(false); return; }

    const { data: profilesData } = await supabase
      .from('profiles').select('id, username, full_name, avatar_url').in('id', mutualIds);

    setFriends((profilesData ?? []) as Friend[]);
    setFriendsLoading(false);
  };

  // ── Role management (Admin only) ─────────────────────────────────────────
  const ROLE_OPTIONS = [
    { value: 'Üye',    label: 'Üye',    color: '#64748B', bg: '#F8FAFC' },
    { value: 'pro',    label: 'Pro',    color: '#15803D', bg: '#F0FDF4' },
    { value: 'editor', label: 'Editör', color: '#1D4ED8', bg: '#EFF6FF' },
    { value: 'admin',  label: 'Admin',  color: '#C2410C', bg: '#FFF7ED' },
  ] as const;

  async function handleRoleChange(newRole: string) {
    if (!profile) return;
    setRoleUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profile.id);
      if (error) throw error;

      // Update local profile state immediately
      setProfile((prev) => prev ? { ...prev, role: newRole } : prev);

      showToast('Kullanıcı yetkisi güncellendi.');
    } catch (err) {
      console.error('[RoleChange]', err);
      Alert.alert('Hata', 'Yetki güncellenemedi, lütfen tekrar deneyin.');
    } finally {
      setRoleUpdating(false);
    }
  }

  // ── Friend button config ──────────────────────────────────────────────────
  function getFriendBtnConfig(): { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; bg: string; textColor: string; borderColor: string } {
    switch (friendship) {
      case 'mutual':    return { label: 'Arkadaşsınız',      icon: 'people',          bg: `${OLIVE}12`, textColor: OLIVE,    borderColor: `${OLIVE}40` };
      case 'following': return { label: 'İstek Gönderildi',  icon: 'person-add',      bg: '#F1F5F9',    textColor: '#64748B', borderColor: '#E2E8F0'   };
      case 'loading':   return { label: 'Yükleniyor…',       icon: 'ellipsis-horizontal', bg: '#F1F5F9', textColor: '#94A3B8', borderColor: '#E2E8F0' };
      default:          return { label: 'Arkadaş Ekle',      icon: 'person-add-outline', bg: OLIVE,     textColor: '#fff',    borderColor: OLIVE       };
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={OLIVE} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="person-outline" size={52} color="#CBD5E1" />
          <Text style={{ fontSize: 16, color: '#94A3B8' }}>Kullanıcı bulunamadı</Text>
          <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
            <Text style={styles.backPillText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roleConfig    = getRoleConfig(profile.role, profile.email);
  const initials      = getInitials(profile.full_name, profile.username);
  const friendBtn     = getFriendBtnConfig();
  const isSelf        = currentUserId === profile.id;
  const isViewerAdmin = currentUserEmail === ADMIN_EMAIL || currentUserRole === 'admin';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── In-app Toast ── */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { opacity: toastOpacity, transform: [{ translateY: toastTransY }] },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      <FriendsModal
        visible={friendsModal}
        friends={friends}
        loading={friendsLoading}
        onClose={() => setFriendsModal(false)}
        onUserPress={(uname) => router.push({ pathname: '/user/[username]', params: { username: uname } })}
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>

        {/* Add Friend button — top right (non-self only) */}
        {!isSelf && currentUserId && (
          <TouchableOpacity
            style={[styles.friendHeaderBtn, { backgroundColor: friendBtn.bg, borderColor: friendBtn.borderColor }]}
            onPress={handleFriendAction}
            activeOpacity={0.8}
            disabled={friendship === 'loading'}
          >
            {friendship === 'loading' ? (
              <ActivityIndicator size="small" color="#94A3B8" />
            ) : (
              <>
                <Ionicons name={friendBtn.icon} size={14} color={friendBtn.textColor} />
                <Text style={[styles.friendHeaderBtnText, { color: friendBtn.textColor }]}>{friendBtn.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {(isSelf || !currentUserId) && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          <Text style={styles.fullName}>{profile.full_name ?? profile.username}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.usernameText}>@{profile.username}</Text>
            {roleConfig && (
              <View style={[styles.roleBadgeInline, { backgroundColor: roleConfig.bg }]}>
                <Ionicons name={roleConfig.icon} size={10} color={roleConfig.color} />
                <Text style={[styles.roleBadgeInlineText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
              </View>
            )}
          </View>

          {/* District chip */}
          {profile.district && (
            <View style={styles.districtChip}>
              <Ionicons name="location" size={13} color="#64748B" />
              <Text style={styles.districtChipText}>{profile.district}</Text>
            </View>
          )}

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {/* Friends count */}
          <TouchableOpacity
            style={styles.friendsBtn}
            activeOpacity={0.75}
            onPress={() => { setFriendsModal(true); loadFriendsModal(); }}
          >
            <Ionicons name="people" size={18} color={OLIVE} />
            <Text style={styles.friendsBtnText}>{friendCount} Arkadaş</Text>
            <Ionicons name="chevron-forward" size={14} color={OLIVE} />
          </TouchableOpacity>

          {/* Friendship status banner */}
          {friendship === 'mutual' && (
            <View style={styles.mutualBanner}>
              <Ionicons name="heart" size={14} color={OLIVE} />
              <Text style={styles.mutualBannerText}>Arkadaşsınız</Text>
            </View>
          )}
        </View>

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          {profile.district && <InfoRow icon="location-outline" label="İlçe" value={profile.district} />}
          {profile.show_email  && profile.email        && <InfoRow icon="mail-outline"  label="E-posta" value={profile.email} />}
          {profile.show_phone  && profile.phone_number && <InfoRow icon="call-outline"  label="Telefon" value={profile.phone_number} />}
          {!profile.district && !profile.show_email && !profile.show_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoHint}>Kullanıcı bilgilerini gizlemiş.</Text>
            </View>
          )}
        </View>

        {/* ── Admin: Kullanıcı Yetkisi Paneli ── */}
        {isViewerAdmin && !isSelf && (
          <View style={styles.roleManagerCard}>
            {/* Header */}
            <View style={styles.roleManagerHeader}>
              <Ionicons name="shield-checkmark" size={16} color="#C2410C" />
              <Text style={styles.roleManagerTitle}>Kullanıcı Yetkisi</Text>
              {roleUpdating && (
                <ActivityIndicator size="small" color="#C2410C" style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={styles.roleManagerSub}>
              Seçilen rol anında uygulanır. Mevcut: <Text style={{ fontWeight: '700', color: '#334155' }}>
                {ROLE_OPTIONS.find((r) => r.value === (profile.role ?? 'Üye'))?.label ?? profile.role ?? 'Üye'}
              </Text>
            </Text>

            {/* Role option pills */}
            <View style={styles.roleOptionsRow}>
              {ROLE_OPTIONS.map((opt) => {
                const isActive = (profile.role ?? 'Üye') === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleOption,
                      {
                        backgroundColor: isActive ? opt.bg : '#F8FAFC',
                        borderColor    : isActive ? opt.color + '55' : '#E2E8F0',
                      },
                    ]}
                    activeOpacity={0.75}
                    disabled={roleUpdating || isActive}
                    onPress={() => handleRoleChange(opt.value)}
                  >
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={13} color={opt.color} />
                    )}
                    <Text style={[styles.roleOptionText, { color: isActive ? opt.color : '#64748B' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color={OLIVE} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)',
    backgroundColor: 'rgba(249,250,251,0.95)',
  },
  backBtn     : { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  headerTitle : { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  headerSpacer: { width: 80 },

  friendHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, minWidth: 80,
  },
  friendHeaderBtnText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },

  scroll: { flex: 1 },

  heroSection: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 24, paddingBottom: 24, gap: 8 },

  avatar        : { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: `${OLIVE}22`, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#D1FAE5',
    shadowColor: OLIVE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 3,
  },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: OLIVE },

  fullName    : { fontSize: 22, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5, marginTop: 4 },
  usernameRow : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usernameText: { fontSize: 14, color: '#94A3B8', fontWeight: '400' },

  roleBadgeInline    : { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 3 },
  roleBadgeInlineText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  districtChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  districtChipText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  bio: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  friendsBtn    : { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${OLIVE}10`, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: `${OLIVE}30`, marginTop: 4 },
  friendsBtnText: { fontSize: 14, fontWeight: '600', color: OLIVE },

  mutualBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${OLIVE}10`, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: `${OLIVE}30` },
  mutualBannerText: { fontSize: 12, fontWeight: '600', color: OLIVE },

  infoCard: {
    marginHorizontal: 24, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  infoRow    : { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)' },
  infoHint   : { fontSize: 13, color: '#94A3B8', flex: 1, paddingLeft: 4 },
  infoIconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  infoTextWrap: { flex: 1, gap: 3 },
  infoLabel  : { fontSize: 11, color: '#94A3B8', fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue  : { fontSize: 14, color: '#1E293B', fontWeight: '500' },

  backPill    : { backgroundColor: OLIVE, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  backPillText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // ── Admin Role Manager ──
  roleManagerCard: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 18,
    shadowColor: '#C2410C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  roleManagerHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 7, marginBottom: 4,
  },
  roleManagerTitle: {
    fontSize: 14, fontWeight: '700',
    color: '#C2410C', letterSpacing: -0.2, flex: 1,
  },
  roleManagerSub: {
    fontSize: 12, color: '#94A3B8',
    fontWeight: '400', marginBottom: 14,
    lineHeight: 17,
  },
  roleOptionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 100, paddingHorizontal: 13, paddingVertical: 8,
    borderWidth: 1.5,
  },
  roleOptionText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },

  // ── Toast ──
  toast: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#15803D',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
  },
});

