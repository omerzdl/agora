/**
 * create-post.tsx
 *
 * 3-Step Wizard
 * ─────────────
 * Step 1 — "Ne paylaşmak istersin?" → Hikaye | Gönderi
 * Step 2 — Category: Ulusal | Yerel | Sosyal
 * Step 3 — Text & Media upload (all existing logic preserved)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Video, ResizeMode } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useDistrict } from '@/lib/DistrictContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const BG           = '#F9FAFB';
const MAX_CHARS    = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Categories & brand palette ──────────────────────────────────────────────
const CATEGORIES = ['Ulusal', 'Yerel', 'Sosyal'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLOR: Record<Category, string> = {
  Ulusal: '#1E3A8A',
  Yerel : '#4D7C0F',
  Sosyal: '#3B82F6',
};

const CATEGORY_ICON: Record<Category, React.ComponentProps<typeof Ionicons>['name']> = {
  Ulusal: 'globe-outline',
  Yerel : 'home-outline',
  Sosyal: 'people-outline',
};

const CATEGORY_DESC: Record<Category, string> = {
  Ulusal: 'Yurt geneli haberler ve gelişmeler',
  Yerel : 'Bölgeye özgü yerel haberler',
  Sosyal: 'Toplumsal yaşam içerikleri',
};

// ─── Wizard steps ─────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

// ─── Media type ───────────────────────────────────────────────────────────────
type MediaType = 'image' | 'video';

// ─── Step dots ───────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[dotStyles.dot, i < current - 1 && dotStyles.dotDone, i === current - 1 && dotStyles.dotActive]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row    : { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot    : { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotDone: { backgroundColor: '#94A3B8' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4D7C0F' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreatePostScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { selectedDistrict } = useDistrict();

  // ── Wizard step ──
  const [step, setStep] = useState<Step>(1);

  // ── Post data ──
  const [category,         setCategory        ] = useState<Category>('Yerel');
  const [text,             setText            ] = useState('');
  const [mediaUri,         setMediaUri        ] = useState<string | null>(null);
  const [mediaType,        setMediaType       ] = useState<MediaType>('image');
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(4 / 3);
  const [uploading,        setUploading       ] = useState(false);

  const isShareable      = text.trim().length > 0 && !uploading;
  const charCount        = text.length;
  const charLimitReached = charCount >= MAX_CHARS;

  // ─── Header config per step ────────────────────────────────────────────────
  const HEADER_TITLES: Record<Step, string> = {
    1: 'Yeni İçerik',
    2: 'Kategori Seç',
    3: 'Yeni Gönderi',
  };

  function handleBack() {
    if (step === 1) { router.back(); return; }
    setStep((prev) => (prev - 1) as Step);
  }

  // ─── Permissions ──────────────────────────────────────────────────────────
  async function requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin vermeniz gerekiyor.', [{ text: 'Tamam' }]);
      return false;
    }
    return true;
  }

  async function requestGalleryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin vermeniz gerekiyor.', [{ text: 'Tamam' }]);
      return false;
    }
    return true;
  }

  // ─── Media helpers ─────────────────────────────────────────────────────────
  async function launchCamera() {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'image');
      if (asset.width && asset.height && asset.width > 0) setMediaAspectRatio(asset.width / asset.height);
    }
  }

  async function launchGallery() {
    const ok = await requestGalleryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'image');
      if (asset.width && asset.height && asset.width > 0) setMediaAspectRatio(asset.width / asset.height);
    }
  }

  function handleAddMedia() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Vazgeç', 'Kamera ile Çek', 'Galeriden Seç'], cancelButtonIndex: 0, title: 'Medya Ekle' },
        (idx) => { if (idx === 1) launchCamera(); else if (idx === 2) launchGallery(); }
      );
    } else {
      Alert.alert('Medya Ekle', undefined, [
        { text: 'Kamera ile Çek', onPress: launchCamera },
        { text: 'Galeriden Seç',  onPress: launchGallery },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
    }
  }

  function handleRemoveMedia() {
    setMediaUri(null);
    setMediaAspectRatio(4 / 3);
  }

  // ─── Upload to Supabase Storage ────────────────────────────────────────────
  async function uploadMedia(uri: string): Promise<string> {
    const cleanUri = uri.split('?')[0];
    const rawExt   = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg';

    const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'm4v'];

    let ext: string;
    let mimeType: string;
    let uploadUri = uri;

    if (VIDEO_EXTS.includes(rawExt)) {
      // ── Video: upload as-is ──
      ext = rawExt;
      mimeType =
        ext === 'mov'  ? 'video/quicktime' :
        ext === 'webm' ? 'video/webm'      :
        ext === 'avi'  ? 'video/x-msvideo' :
        'video/mp4';
    } else {
      // ── Image: compress & convert to JPEG before upload ──
      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.7, format: SaveFormat.JPEG },
      );
      uploadUri = manipResult.uri;
      ext       = 'jpg';
      mimeType  = 'image/jpeg';
    }

    const response = await fetch(uploadUri);
    if (!response.ok) throw new Error(`Dosya okunamadı: HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Dosya boş – medya verisi okunamadı.');

    const fileName = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
    if (!publicUrl) throw new Error('Public URL alınamadı.');
    return publicUrl;
  }

  // ─── Share (Step 3 submit) ─────────────────────────────────────────────────
  async function handleShare() {
    if (!isShareable) return;
    setUploading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        Alert.alert('Giriş Gerekli', 'Gönderi paylaşmak için lütfen önce giriş yapın.', [
          { text: 'Giriş Yap', onPress: () => router.replace('/auth') },
          { text: 'Vazgeç', style: 'cancel' },
        ]);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Gönderi paylaşmak için lütfen önce giriş yapın.');
        return;
      }

      let mediaUrl: string | null = null;
      if (mediaUri) {
        try {
          mediaUrl = await uploadMedia(mediaUri);
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : 'Bilinmeyen yükleme hatası';
          Alert.alert('Medya Yüklenemedi', msg);
          return;
        }
        if (!mediaUrl) {
          Alert.alert('Medya Yüklenemedi', 'Lütfen tekrar deneyin.');
          return;
        }
      }

      const payload = {
        image         : mediaUrl,
        category      : category,
        category_color: CATEGORY_COLOR[category],
        title         : text.trim().slice(0, 50),
        description   : text.trim(),
        user_id       : user.id,
        media_type    : mediaUri ? mediaType : null,
        district      : selectedDistrict,
      };

      const { error: insertError } = await supabase.from('feed').insert(payload);
      if (insertError) throw insertError;

      setText('');
      setMediaUri(null);
      setCategory('Yerel');
      setMediaAspectRatio(4 / 3);

      Alert.alert('Paylaşıldı 🎉', 'Gönderiniz başarıyla yayınlandı.', [
        { text: 'Harika!', onPress: () => router.dismiss() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Beklenmeyen bir hata oluştu.';
      Alert.alert('Hata', message);
    } finally {
      setUploading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSideBtn}
            activeOpacity={0.7}
            onPress={handleBack}
            disabled={uploading}
          >
            {step === 1 ? (
              <Text style={[styles.cancelText, uploading && { opacity: 0.4 }]}>Vazgeç</Text>
            ) : (
              <View style={styles.backBtnInner}>
                <Ionicons name="chevron-back" size={18} color="#64748B" />
                <Text style={styles.cancelText}>Geri</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{HEADER_TITLES[step]}</Text>
            {step === 3 && (
              <View style={styles.districtBadge}>
                <Ionicons name="location" size={11} color="#4D7C0F" />
                <Text style={styles.districtBadgeText}>{selectedDistrict}</Text>
              </View>
            )}
            {step > 1 && <StepDots current={step} total={3} />}
          </View>

          <View style={styles.headerSideBtn}>
            {step === 3 ? (
              <TouchableOpacity
                style={[styles.shareBtn, !isShareable && styles.shareBtnDisabled]}
                activeOpacity={isShareable ? 0.7 : 1}
                onPress={handleShare}
                disabled={!isShareable}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#4D7C0F" />
                ) : (
                  <Text style={[styles.shareText, !isShareable && { opacity: 0.35 }]}>Paylaş</Text>
                )}
              </TouchableOpacity>
            ) : (
              // placeholder to keep header symmetric
              <View />
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ══════════════════════════════════════════════════
            STEP 1 — Content Type
        ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.step1Container}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepHeading}>Ne paylaşmak istersin?</Text>
            <Text style={styles.stepSubheading}>İçerik türünü seçerek devam et.</Text>

            {/* ── Hikaye Card ── */}
            <TouchableOpacity
              style={styles.typeCard}
              activeOpacity={0.82}
              onPress={() => router.replace('/create-story')}
            >
              <View style={[styles.typeCardIcon, { backgroundColor: '#4D7C0F18' }]}>
                <Ionicons name="camera-outline" size={36} color="#4D7C0F" />
              </View>
              <View style={styles.typeCardText}>
                <Text style={[styles.typeCardTitle, { color: '#4D7C0F' }]}>Hikaye</Text>
                <Text style={styles.typeCardDesc}>
                  10 saniyelik anlık içerik — görseller ve videolar
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {/* ── Gönderi Card ── */}
            <TouchableOpacity
              style={styles.typeCard}
              activeOpacity={0.82}
              onPress={() => setStep(2)}
            >
              <View style={[styles.typeCardIcon, { backgroundColor: '#1E3A8A18' }]}>
                <Ionicons name="newspaper-outline" size={36} color="#1E3A8A" />
              </View>
              <View style={styles.typeCardText}>
                <Text style={[styles.typeCardTitle, { color: '#1E3A8A' }]}>Gönderi</Text>
                <Text style={styles.typeCardDesc}>
                  Haber, duyuru veya bölgesel içerik paylaş
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ══════════════════════════════════════════════════
            STEP 2 — Category Selection
        ══════════════════════════════════════════════════ */}
        {step === 2 && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.step2Container}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepHeading}>Kategori Seç</Text>
            <Text style={styles.stepSubheading}>Gönderini en iyi tanımlayan kategoriyi seç.</Text>

            {CATEGORIES.map((cat) => {
              const color = CATEGORY_COLOR[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryCard, { borderColor: `${color}40` }]}
                  activeOpacity={0.82}
                  onPress={() => { setCategory(cat); setStep(3); }}
                >
                  <View style={[styles.categoryCardIcon, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={CATEGORY_ICON[cat]} size={30} color={color} />
                  </View>
                  <View style={styles.categoryCardText}>
                    <Text style={[styles.categoryCardTitle, { color }]}>{cat}</Text>
                    <Text style={styles.categoryCardDesc}>{CATEGORY_DESC[cat]}</Text>
                  </View>
                  <View style={[styles.categoryCardArrow, { backgroundColor: `${color}12` }]}>
                    <Ionicons name="chevron-forward" size={18} color={color} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ══════════════════════════════════════════════════
            STEP 3 — Text & Media
        ══════════════════════════════════════════════════ */}
        {step === 3 && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Active category indicator (tappable → go back to step 2) ── */}
            <View style={styles.activeCategoryRow}>
              <TouchableOpacity
                style={[styles.activeCategoryChip, { backgroundColor: `${CATEGORY_COLOR[category]}15`, borderColor: `${CATEGORY_COLOR[category]}50` }]}
                activeOpacity={0.7}
                onPress={() => setStep(2)}
                disabled={uploading}
              >
                <Ionicons name={CATEGORY_ICON[category]} size={14} color={CATEGORY_COLOR[category]} />
                <Text style={[styles.activeCategoryText, { color: CATEGORY_COLOR[category] }]}>
                  {category}
                </Text>
                <Ionicons name="pencil" size={11} color={CATEGORY_COLOR[category]} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            </View>

            {/* ── Text Input ── */}
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Neler oluyor? Ne paylaşmak istersin?"
                placeholderTextColor="#94A3B8"
                multiline
                value={text}
                onChangeText={(val) => { if (val.length <= MAX_CHARS) setText(val); }}
                autoFocus
                textAlignVertical="top"
                editable={!uploading}
              />
              <Text style={[styles.charCounter, charLimitReached && styles.charCounterLimit]}>
                {charCount}/{MAX_CHARS}
              </Text>
            </View>

            {/* ── Media Preview ── */}
            {mediaUri && (
              <View style={styles.mediaPreviewContainer}>
                {mediaType === 'video' ? (
                  <View style={[styles.videoPreviewWrap, { aspectRatio: mediaAspectRatio }]}>
                    <Video
                      source={{ uri: mediaUri }}
                      style={styles.videoPreview}
                      resizeMode={ResizeMode.CONTAIN}
                      useNativeControls
                      isLooping={false}
                      shouldPlay={false}
                    />
                    <View style={styles.videoPlayBadge}>
                      <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                    </View>
                    <View style={styles.videoBadge}>
                      <Ionicons name="videocam" size={12} color="#fff" />
                      <Text style={styles.videoBadgeText}>Video</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: mediaUri }}
                    style={[styles.imagePreview, { aspectRatio: mediaAspectRatio }]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                )}
                {!uploading && (
                  <TouchableOpacity style={styles.removeMediaBtn} activeOpacity={0.8} onPress={handleRemoveMedia}>
                    <Ionicons name="close-circle" size={26} color="#0F172A" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Media Toolbar ── */}
            <View style={styles.toolbar}>
              <View style={styles.toolbarDivider} />
              <View style={styles.toolbarRow}>
                <TouchableOpacity
                  style={[styles.toolbarBtn, uploading && { opacity: 0.4 }]}
                  activeOpacity={0.7}
                  onPress={handleAddMedia}
                  disabled={uploading}
                >
                  <Ionicons name="image-outline" size={26} color="#4D7C0F" />
                  <Text style={styles.toolbarBtnText}>Medya Ekle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BG,
  },
  headerSideBtn: { minWidth: 72 },
  headerCenter : { flex: 1, alignItems: 'center', gap: 4 },
  backBtnInner : { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cancelText   : { fontSize: 15, color: '#64748B', fontWeight: '400' },
  headerTitle  : { fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  districtBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#4D7C0F12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  districtBadgeText: { fontSize: 11, color: '#4D7C0F', fontWeight: '600' },
  shareBtn     : { alignItems: 'flex-end', minWidth: 72 },
  shareBtnDisabled: { opacity: 0.4 },
  shareText    : { fontSize: 15, color: '#4D7C0F', fontWeight: '600' },

  divider: { height: 1, backgroundColor: 'rgba(226,232,240,0.8)' },
  scroll : { flex: 1 },

  // ── Step 1 ──
  step1Container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 14,
  },
  stepHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepSubheading: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    marginBottom: 8,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  typeCardIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  typeCardText: { flex: 1, gap: 4 },
  typeCardTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  typeCardDesc : { fontSize: 13, color: '#64748B', fontWeight: '400', lineHeight: 18 },

  // ── Step 2 ──
  step2Container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  categoryCardIcon : {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  categoryCardText : { flex: 1, gap: 3 },
  categoryCardTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  categoryCardDesc : { fontSize: 12, color: '#64748B', fontWeight: '400', lineHeight: 17 },
  categoryCardArrow: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Step 3 ──
  activeCategoryRow: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  activeCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  activeCategoryText: { fontSize: 13, fontWeight: '600' },

  textInputContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    minHeight: 180,
  },
  textInput: {
    fontSize: 16, color: '#0F172A', lineHeight: 24,
    fontWeight: '400', flex: 1, minHeight: 140,
  },
  charCounter     : { alignSelf: 'flex-end', fontSize: 12, color: '#CBD5E1', fontWeight: '400', marginTop: 8 },
  charCounterLimit: { color: '#EF4444', fontWeight: '600' },

  mediaPreviewContainer: {
    marginHorizontal: 20, marginTop: 4, marginBottom: 12, overflow: 'visible',
  },
  imagePreview: { width: SCREEN_WIDTH - 40, borderRadius: 16, backgroundColor: '#E2E8F0' },
  videoPreviewWrap: {
    width: SCREEN_WIDTH - 40, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0F172A',
  },
  videoPreview: { width: '100%', height: '100%' },
  videoPlayBadge: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoBadge: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  videoBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  removeMediaBtn: {
    position: 'absolute', top: -10, right: -10,
    backgroundColor: '#FFFFFF', borderRadius: 13,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },

  toolbar       : { paddingHorizontal: 20, paddingTop: 4 },
  toolbarDivider: { height: 1, backgroundColor: 'rgba(226,232,240,0.7)', marginBottom: 12 },
  toolbarRow    : { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarBtn    : { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  toolbarBtnText: { fontSize: 14, color: '#4D7C0F', fontWeight: '500' },
});
