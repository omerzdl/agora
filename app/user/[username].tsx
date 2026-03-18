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
  Platform,
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

    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

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
  const isSelf        = currentUserId === profile.id;
  const isViewerAdmin = currentUserEmail === ADMIN_EMAIL || currentUserRole === 'admin';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── In-app Toast ── */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastOpacity, transform: [{ translateY: toastTransY }] },
            { pointerEvents: 'none' },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={styles.headerSpacer} />
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
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },

  heroSection: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 24, paddingBottom: 24, gap: 8 },

  avatar        : { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: `${OLIVE}22`, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#D1FAE5',
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(77,124,15,0.14)' },
      default: { shadowColor: OLIVE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12 },
    }),
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

  infoCard: {
    marginHorizontal: 24, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden',
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
    }),
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
    elevation: 2,
    ...Platform.select({
      web: { boxShadow: '0px 2px 10px rgba(194,65,12,0.07)' },
      default: { shadowColor: '#C2410C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },
    }),
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
    elevation: 10,
    zIndex: 999,
    ...Platform.select({
      web: { boxShadow: '0px 6px 16px rgba(21,128,61,0.35)' },
      default: { shadowColor: '#15803D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
    }),
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
  },
});

