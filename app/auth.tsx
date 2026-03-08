import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DISTRICTS, District } from '@/lib/DistrictContext';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG = '#F9FAFB';

type Mode = 'login' | 'signup';

// ─── Minimal inline dropdown ─────────────────────────────────────────────────
function DistrictPicker({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: District; onSelect: (d: District) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={dpStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={dpStyles.card}>
              <Text style={dpStyles.title}>İlçe Seç</Text>
              {DISTRICTS.map((d, i) => {
                const isActive = d === selected;
                const isLast = i === DISTRICTS.length - 1;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[dpStyles.item, !isLast && dpStyles.itemBorder]}
                    onPress={() => { onSelect(d); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[dpStyles.itemText, isActive && dpStyles.itemActive]}>{d}</Text>
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

const dpStyles = StyleSheet.create({
  overlay  : { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  card     : { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 320, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20 },
  title    : { fontSize: 13, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  item     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)' },
  itemText : { fontSize: 16, fontWeight: '400', color: '#1E293B' },
  itemActive: { fontWeight: '600', color: OLIVE },
});

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');

  // ── Shared fields ──
  const [email,       setEmail      ] = useState('');
  const [password,    setPassword   ] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Signup-only fields ──
  const [username,    setUsername   ] = useState('');
  const [fullName,    setFullName   ] = useState('');
  const [bio,         setBio        ] = useState('');
  const [avatarUrl,   setAvatarUrl  ] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [district,    setDistrict   ] = useState<District>('Bergama');
  const [showEmail,   setShowEmail  ] = useState(false);
  const [showPhone,   setShowPhone  ] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);

  const [loading,     setLoading    ] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setUsername('');
    setFullName('');
    setBio('');
    setAvatarUrl('');
    setPhoneNumber('');
    setDistrict('Bergama');
    setShowEmail(false);
    setShowPhone(false);
  }

  // ── Username uniqueness check ──────────────────────────────────────────────
  async function isUsernameTaken(uname: string): Promise<boolean> {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', uname.trim().toLowerCase())
      .maybeSingle();
    return !!data;
  }

  // ── Email / Password Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    if (mode === 'signup') {
      if (!username.trim()) {
        Alert.alert('Eksik Bilgi', 'Lütfen bir kullanıcı adı seçin.');
        return;
      }
      if (!fullName.trim()) {
        Alert.alert('Eksik Bilgi', 'Lütfen ad soyad giriniz.');
        return;
      }
      if (!district) {
        Alert.alert('Eksik Bilgi', 'Lütfen ilçenizi seçin.');
        return;
      }
      // Validate username format (alphanumeric + underscore only)
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
        Alert.alert(
          'Geçersiz Kullanıcı Adı',
          'Kullanıcı adı 3-30 karakter olmalı; sadece harf, rakam ve _ içerebilir.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace('/(tabs)');
      } else {
        // ── Unique username check ──────────────────────────────────────────
        const taken = await isUsernameTaken(username.trim());
        if (taken) {
          Alert.alert('Kullanıcı Adı Alınmış', 'Bu kullanıcı adı zaten kullanılıyor. Başka bir ad deneyin.');
          setLoading(false);
          return;
        }

        // ── Sign Up ──────────────────────────────────────────────────────
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username   : username.trim().toLowerCase(),
              full_name  : fullName.trim(),
              phone_number: phoneNumber.trim() || null,
            },
          },
        });
        if (error) throw error;

        // Save extended profile
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id          : data.user.id,
              username    : username.trim().toLowerCase(),
              full_name   : fullName.trim(),
              bio         : bio.trim() || null,
              avatar_url  : avatarUrl.trim() || null,
              district    : district,
              phone_number: phoneNumber.trim() || null,
              email       : email.trim(),
              show_email  : showEmail,
              show_phone  : showPhone,
            });
          if (profileError) {
            console.warn('[Auth] Profil kaydedilemedi:', profileError.message);
          }
        }

        Alert.alert(
          'Hoş Geldiniz! 🎉',
          'Hesabınız başarıyla oluşturuldu. Lütfen e-postanızı doğrulayın.',
          [{ text: 'Tamam', onPress: () => switchMode('login') }]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir sorun oluştu.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    Alert.alert('Çok Yakında 🚧', 'Gmail ile giriş özelliği yakında aktif olacak.', [{ text: 'Anladım' }]);
  }
  function handleAppleLogin() {
    Alert.alert('Çok Yakında 🚧', 'iCloud ile giriş özelliği yakında aktif olacak.', [{ text: 'Anladım' }]);
  }
  function handlePhoneLogin() {
    Alert.alert('Çok Yakında 🚧', 'Telefon numarası ile giriş özelliği yakında aktif olacak.', [{ text: 'Anladım' }]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      {/* District picker modal */}
      <DistrictPicker
        visible={districtOpen}
        selected={district}
        onSelect={setDistrict}
        onClose={() => setDistrictOpen(false)}
      />

      {/* ── Back Button ── */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color="#334155" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand Mark ── */}
        <View style={styles.brandWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf-outline" size={38} color={OLIVE} />
          </View>
          <Text style={styles.brandName}>Agora</Text>
          <Text style={styles.brandTagline}>Şehrinle bağlantıda kal</Text>
        </View>

        {/* ── Mode Toggle ── */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
            onPress={() => switchMode('login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Giriş Yap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
            onPress={() => switchMode('signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Kayıt Ol</Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>

          {/* ── SIGNUP ONLY FIELDS ── */}
          {mode === 'signup' && (
            <>
              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kullanıcı Adı <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="at-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
                    placeholder="kullanici_adi"
                    placeholderTextColor="#CBD5E1"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                <Text style={styles.hint}>3–30 karakter, harf/rakam/_</Text>
              </View>

              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ad Soyad <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Adınız Soyadınız"
                    placeholderTextColor="#CBD5E1"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* District */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>İlçe <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.inputWrap, styles.pickerWrap]}
                  activeOpacity={0.75}
                  onPress={() => setDistrictOpen(true)}
                >
                  <Ionicons name="location-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <Text style={[styles.input, styles.pickerText]}>{district}</Text>
                  <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Bio */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Hakkımda <Text style={styles.labelOptional}>(isteğe bağlı)</Text>
                </Text>
                <View style={[styles.inputWrap, styles.bioWrap]}>
                  <TextInput
                    style={[styles.input, styles.bioInput]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Kendinizi kısaca tanıtın…"
                    placeholderTextColor="#CBD5E1"
                    multiline
                    numberOfLines={3}
                    maxLength={160}
                    returnKeyType="next"
                  />
                </View>
                <Text style={styles.charCount}>{bio.length}/160</Text>
              </View>

              {/* Avatar URL */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Profil Fotoğrafı URL <Text style={styles.labelOptional}>(isteğe bağlı)</Text>
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="image-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={avatarUrl}
                    onChangeText={setAvatarUrl}
                    placeholder="https://…"
                    placeholderTextColor="#CBD5E1"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                  />
                </View>
              </View>
            </>
          )}

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@eposta.com"
                placeholderTextColor="#CBD5E1"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şifre <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#CBD5E1"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType={mode === 'signup' ? 'next' : 'done'}
                onSubmitEditing={mode === 'signup' ? undefined : handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SIGNUP ONLY CONTINUED ── */}
          {mode === 'signup' && (
            <>
              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Telefon Numarası <Text style={styles.labelOptional}>(isteğe bağlı)</Text>
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="+90 5XX XXX XX XX"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Privacy Toggles */}
              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>Gizlilik Ayarları</Text>

                <View style={styles.toggleItem}>
                  <View style={styles.toggleItemLeft}>
                    <Ionicons name="mail-outline" size={18} color="#64748B" />
                    <View>
                      <Text style={styles.toggleItemLabel}>E-postayı Göster</Text>
                      <Text style={styles.toggleItemSub}>Profilinde e-posta görünsün</Text>
                    </View>
                  </View>
                  <Switch
                    value={showEmail}
                    onValueChange={setShowEmail}
                    trackColor={{ false: '#E2E8F0', true: `${OLIVE}55` }}
                    thumbColor={showEmail ? OLIVE : '#CBD5E1'}
                  />
                </View>

                <View style={[styles.toggleItem, styles.toggleItemLast]}>
                  <View style={styles.toggleItemLeft}>
                    <Ionicons name="call-outline" size={18} color="#64748B" />
                    <View>
                      <Text style={styles.toggleItemLabel}>Telefonu Göster</Text>
                      <Text style={styles.toggleItemSub}>Profilinde telefon görünsün</Text>
                    </View>
                  </View>
                  <Switch
                    value={showPhone}
                    onValueChange={setShowPhone}
                    trackColor={{ false: '#E2E8F0', true: `${OLIVE}55` }}
                    thumbColor={showPhone ? OLIVE : '#CBD5E1'}
                  />
                </View>
              </View>
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer hint */}
          <Text style={styles.footerHint}>
            {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <Text style={styles.hintLink} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}
            </Text>
          </Text>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social Auth Buttons ── */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={20} color="#EA4335" />
              <Text style={styles.socialBtnText}>Gmail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={20} color="#0F172A" />
              <Text style={styles.socialBtnText}>iCloud</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={handlePhoneLogin} activeOpacity={0.8}>
              <Ionicons name="phone-portrait-outline" size={20} color="#0284C7" />
              <Text style={styles.socialBtnText}>Telefon</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.comingSoon}>* Sosyal giriş özellikleri çok yakında aktif olacak.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root   : { flex: 1, backgroundColor: BG },
  backBtn: {
    position: 'absolute', top: 56, left: 16, zIndex: 10,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  // Brand
  brandWrap  : { alignItems: 'center', marginTop: 80, marginBottom: 36, gap: 8 },
  logoCircle : {
    width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    shadowColor: OLIVE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 3,
  },
  brandName   : { fontSize: 28, fontWeight: '700', color: '#0F172A', letterSpacing: -0.6 },
  brandTagline: { fontSize: 14, color: '#94A3B8', fontWeight: '400' },

  // Toggle
  toggleRow      : { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 28 },
  toggleBtn      : { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText     : { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
  toggleTextActive: { color: '#0F172A' },

  // Form
  form      : { gap: 18 },
  inputGroup: { gap: 6 },
  label     : { fontSize: 13, fontWeight: '500', color: '#475569', marginLeft: 2 },
  required  : { color: '#E11D48' },
  labelOptional: { fontSize: 12, fontWeight: '400', color: '#94A3B8' },
  hint      : { fontSize: 11, color: '#94A3B8', marginLeft: 2 },
  charCount : { fontSize: 11, color: '#CBD5E1', textAlign: 'right' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, height: 52,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  pickerWrap: { height: 52 },
  pickerText: { color: '#0F172A', fontWeight: '400' },
  bioWrap   : { height: 'auto', minHeight: 86, alignItems: 'flex-start', paddingVertical: 10 },
  bioInput  : { height: undefined, textAlignVertical: 'top' },
  inputIcon : { marginRight: 10 },
  input     : { flex: 1, fontSize: 15, color: '#0F172A', height: '100%' },
  inputPassword: { paddingRight: 4 },
  eyeBtn    : { padding: 4, marginLeft: 6 },

  // Privacy
  privacySection: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  privacySectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  toggleItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.6)',
  },
  toggleItemLast: {},
  toggleItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleItemLabel: { fontSize: 14, fontWeight: '500', color: '#1E293B' },
  toggleItemSub  : { fontSize: 11, color: '#94A3B8', fontWeight: '400' },

  // Submit
  submitBtn: {
    backgroundColor: OLIVE, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: OLIVE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },

  footerHint: { textAlign: 'center', fontSize: 13, color: '#94A3B8', marginTop: 4 },
  hintLink  : { color: OLIVE, fontWeight: '600' },

  // Divider
  dividerRow : { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, color: '#94A3B8', fontWeight: '400' },

  // Social
  socialRow  : { flexDirection: 'row', gap: 12 },
  socialBtn  : {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingVertical: 13,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  socialBtnText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  comingSoon   : { textAlign: 'center', fontSize: 11, color: '#CBD5E1', fontWeight: '400', marginTop: -4 },
});
