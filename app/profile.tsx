import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ADMIN_EMAIL, supabase } from '@/lib/supabase';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';
const RED   = '#EF4444';

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = {
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

// ─── Role badge config ────────────────────────────────────────────────────────
// Admin  → Gold/Red  shield-checkmark
// Editör → Blue tick checkmark-circle
// Pro    → Green tick checkmark-circle
function getRoleConfig(role: string | null, email: string | null): {
  label: string; bg: string; color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
} | null {
  const normalizedEmail = (email ?? '').toLowerCase();
  const normalizedAdminEmail = ADMIN_EMAIL.toLowerCase();
  if (normalizedEmail === normalizedAdminEmail || role === 'admin')
    return { label: 'Admin',  bg: '#FFF7ED', color: '#C2410C', icon: 'shield-checkmark' };
  if (role === 'editor')
    return { label: 'Editör', bg: '#EFF6FF', color: '#1D4ED8', icon: 'checkmark-circle' };
  if (role === 'pro')
    return { label: 'Pro',    bg: '#F0FDF4', color: '#15803D', icon: 'checkmark-circle' };
  return null;
}

// ─── Initials avatar ─────────────────────────────────────────────────────────
function getInitials(fullName: string | null, username: string): string {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile,      setProfile     ] = useState<Profile | null>(null);
  const [loading,      setLoading     ] = useState(true);
  const [signingOut,   setSigningOut  ] = useState(false);

  // ── Profile editing ──────────────────────────────────────────────────────
  const [editAvatarUri,  setEditAvatarUri ] = useState<string | null>(null); // local picker URI
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, bio, avatar_url, district, email, phone_number, show_email, show_phone, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.error('[Profile] load error:', error.message);

    // Build profile: merge auth user data with profiles table data
    const built: Profile = {
      id          : user.id,
      username    : data?.username    ?? user.user_metadata?.username ?? user.email?.split('@')[0] ?? '—',
      full_name   : data?.full_name   ?? user.user_metadata?.full_name ?? null,
      bio         : data?.bio         ?? null,
      avatar_url  : data?.avatar_url  ?? null,
      district    : data?.district    ?? null,
      email       : data?.email       ?? user.email ?? null,
      phone_number: data?.phone_number ?? null,
      show_email  : data?.show_email  ?? false,
      show_phone  : data?.show_phone  ?? false,
      role        : data?.role        ?? null,
    };
    setProfile(built);
    setLoading(false);

  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadProfile();
  }, [loadProfile]));

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      router.replace('/(tabs)');
    }
  }

  // ── Pick avatar from gallery ──────────────────────────────────────────────
  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin vermeniz gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      setEditAvatarUri(result.assets[0].uri);
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
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="dark" />
        <Ionicons name="person-outline" size={48} color="#CBD5E1" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Giriş yapmanız gerekiyor</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')} activeOpacity={0.8}>
          <Text style={styles.loginBtnText}>Giriş Yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roleConfig = getRoleConfig(profile.role, profile.email);
  const initials   = getInitials(profile.full_name, profile.username);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profilim</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Name section ── */}
        <View style={styles.heroSection}>
          {/* Avatar with camera-overlay edit button */}
          <View style={styles.avatarWrap}>
            {(editAvatarUri ?? profile.avatar_url) ? (
              <Image
                source={{ uri: editAvatarUri ?? profile.avatar_url! }}
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
            <TouchableOpacity
              style={styles.avatarEditOverlay}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={15} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Full name */}
          <Text style={styles.fullName}>{profile.full_name ?? profile.username}</Text>

          {/* Editable username + inline role badge */}
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

          {/* Bio */}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

        </View>

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          {/* District */}
          {profile.district && (
            <InfoRow icon="location-outline" label="İlçe" value={profile.district} />
          )}

          {/* Email — only if show_email */}
          {profile.show_email && profile.email && (
            <InfoRow icon="mail-outline" label="E-posta" value={profile.email} />
          )}

          {/* Phone — only if show_phone */}
          {profile.show_phone && profile.phone_number && (
            <InfoRow icon="call-outline" label="Telefon" value={profile.phone_number} />
          )}

          {/* Always show the district row at minimum; if nothing to show, show a hint */}
          {!profile.district && !profile.show_email && !profile.show_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoHint}>Profil bilgileri gizlilik ayarlarınıza göre gösterilir.</Text>
            </View>
          )}
        </View>

        {/* ── Privacy notice ── */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
          <Text style={styles.privacyNoteText}>
            Profil bilgileri kayıt sırasında belirlendi ve değiştirilemez.
          </Text>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
          onPress={handleSignOut}
          activeOpacity={0.8}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={RED} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={RED} />
              <Text style={styles.signOutText}>Çıkış Yap</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Info Row Component ───────────────────────────────────────────────────────
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

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)',
    backgroundColor: 'rgba(249,250,251,0.95)',
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  headerTitle : { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },

  // Hero
  heroSection: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 24, paddingBottom: 24, gap: 8 },

  // Avatar with edit overlay
  avatarWrap: { position: 'relative', marginBottom: 2 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
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
  avatarEditOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: OLIVE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    elevation: 4,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.18)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
    }),
  },

  fullName   : { fontSize: 22, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5, marginTop: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usernameText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },

  roleBadgeInline: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 100, paddingHorizontal: 7, paddingVertical: 3,
  },
  roleBadgeInlineText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  districtChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  districtChipText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  bio: { fontSize: 14, color: '#475569', fontWeight: '400', textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  // Info Card
  infoCard: {
    marginHorizontal: 24, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden',
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
    }),
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)',
  },
  infoHint: { fontSize: 13, color: '#94A3B8', fontWeight: '400', flex: 1, paddingLeft: 4 },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center',
  },
  infoTextWrap: { flex: 1, gap: 3 },
  infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, color: '#1E293B', fontWeight: '500' },

  // Privacy note
  privacyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 24, marginTop: 12,
  },
  privacyNoteText: { fontSize: 11, color: '#94A3B8', fontWeight: '400', flex: 1 },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: RED,
    paddingVertical: 14, backgroundColor: '#FEF2F2',
    marginHorizontal: 24, marginTop: 20,
  },
  signOutBtnDisabled: { opacity: 0.6 },
  signOutText: { fontSize: 15, fontWeight: '600', color: RED, letterSpacing: -0.2 },

  // Login prompt
  loginBtn: {
    marginTop: 16, backgroundColor: OLIVE, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
