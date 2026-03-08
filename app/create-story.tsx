/**
 * create-story.tsx  (Admin-only modal)
 *
 * Lets the admin user pick a photo or video and publish it as a Story
 * scoped to the currently active district.
 *
 * Supabase table expected:
 *   stories (id, media_url, media_type, district, title, user_id, created_at)
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
import { Video, ResizeMode } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useDistrict } from '@/lib/DistrictContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const OLIVE        = '#4D7C0F';
const BG           = '#F9FAFB';
const MAX_TITLE    = 120;
const SCREEN_WIDTH = Dimensions.get('window').width;

type MediaType = 'image' | 'video';

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreateStoryScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { selectedDistrict } = useDistrict();

  const [title,            setTitle           ] = useState('');
  const [mediaUri,         setMediaUri        ] = useState<string | null>(null);
  const [mediaType,        setMediaType       ] = useState<MediaType>('image');
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(9 / 16);
  const [uploading,        setUploading       ] = useState(false);

  const isShareable = mediaUri !== null && !uploading;

  // ── Camera permission ──
  async function requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera erişimi için izin vermeniz gerekiyor.', [{ text: 'Tamam' }]);
      return false;
    }
    return true;
  }

  // ── Gallery permission ──
  async function requestGalleryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişimi için izin vermeniz gerekiyor.', [{ text: 'Tamam' }]);
      return false;
    }
    return true;
  }

  // ── Launch Camera ──
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
      if (asset.width && asset.height && asset.width > 0) {
        setMediaAspectRatio(asset.width / asset.height);
      }
    }
  }

  // ── Launch Gallery ──
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
      if (asset.width && asset.height && asset.width > 0) {
        setMediaAspectRatio(asset.width / asset.height);
      }
    }
  }

  // ── Media Picker ──
  function handlePickMedia() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Vazgeç', 'Kamera ile Çek', 'Galeriden Seç'], cancelButtonIndex: 0, title: 'Medya Seç' },
        (idx) => {
          if (idx === 1) launchCamera();
          else if (idx === 2) launchGallery();
        }
      );
    } else {
      Alert.alert('Medya Seç', undefined, [
        { text: 'Kamera ile Çek', onPress: launchCamera },
        { text: 'Galeriden Seç',  onPress: launchGallery },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
    }
  }

  // ── Upload to Supabase Storage ──
  async function uploadMedia(uri: string): Promise<string> {
    const cleanUri = uri.split('?')[0];
    const rawExt   = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg';

    const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'm4v'];

    let ext: string;
    let mimeType: string;

    if (VIDEO_EXTS.includes(rawExt)) {
      ext = rawExt;
      mimeType = ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
    } else if (IMAGE_EXTS.includes(rawExt)) {
      ext = rawExt;
      mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    } else {
      ext      = mediaType === 'video' ? 'mp4' : 'jpg';
      mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    }

    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Dosya okunamadı: HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Boş dosya – medya seçimi başarısız.');

    const fileName = `story_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
    if (!publicUrl) throw new Error('Public URL alınamadı.');
    return publicUrl;
  }

  // ── Publish Story ──
  async function handlePublish() {
    if (!isShareable || !mediaUri) return;
    setUploading(true);

    try {
      // Auth check
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Hikaye paylaşmak için giriş yapmalısınız.');
        return;
      }

      // Upload media
      const mediaUrl = await uploadMedia(mediaUri);

      // Insert into `stories` table
      const { error: insertError } = await supabase.from('stories').insert({
        media_url  : mediaUrl,
        media_type : mediaType,
        district   : selectedDistrict,
        title      : title.trim() || null,
        user_id    : user.id,
      });

      if (insertError) throw insertError;

      Alert.alert('Yayınlandı 🎉', 'Hikayeniz başarıyla paylaşıldı.', [
        { text: 'Harika!', onPress: () => router.dismiss() },
      ]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Beklenmeyen bir hata oluştu.';
      Alert.alert('Hata', msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSideBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
            disabled={uploading}
          >
            <Text style={[styles.cancelText, uploading && { opacity: 0.4 }]}>Vazgeç</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Hikaye Paylaş</Text>
            <View style={styles.districtBadge}>
              <Ionicons name="location" size={11} color={OLIVE} />
              <Text style={styles.districtBadgeText}>{selectedDistrict}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.headerSideBtn, styles.publishBtn, !isShareable && styles.publishBtnDisabled]}
            activeOpacity={isShareable ? 0.7 : 1}
            onPress={handlePublish}
            disabled={!isShareable}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={OLIVE} />
            ) : (
              <Text style={[styles.publishText, !isShareable && { opacity: 0.35 }]}>Paylaş</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Media picker / preview ── */}
          {!mediaUri ? (
            <TouchableOpacity style={styles.mediaPickerEmpty} onPress={handlePickMedia} activeOpacity={0.8}>
              <View style={styles.mediaPickerIcon}>
                <Ionicons name="add" size={36} color={OLIVE} />
              </View>
              <Text style={styles.mediaPickerLabel}>Fotoğraf veya Video Seç</Text>
              <Text style={styles.mediaPickerHint}>Hikayeler 10 saniye sonra otomatik ilerler</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.mediaPreviewWrap}>
              {mediaType === 'video' ? (
                <View style={[styles.videoWrap, { aspectRatio: mediaAspectRatio }]}>
                  <Video
                    source={{ uri: mediaUri }}
                    style={styles.videoFill}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={false}
                  />
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

              {/* Change / remove controls */}
              {!uploading && (
                <View style={styles.mediaActions}>
                  <TouchableOpacity style={styles.mediaActionBtn} onPress={handlePickMedia} activeOpacity={0.8}>
                    <Ionicons name="swap-horizontal" size={16} color={OLIVE} />
                    <Text style={styles.mediaActionText}>Değiştir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mediaActionBtn, styles.mediaActionRemove]}
                    onPress={() => { setMediaUri(null); setMediaAspectRatio(9 / 16); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={[styles.mediaActionText, { color: '#EF4444' }]}>Kaldır</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Title input ── */}
          <View style={styles.titleSection}>
            <Text style={styles.titleLabel}>Başlık (İsteğe Bağlı)</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Hikayenize bir başlık ekleyin…"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={(v) => { if (v.length <= MAX_TITLE) setTitle(v); }}
              multiline={false}
              editable={!uploading}
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{title.length}/{MAX_TITLE}</Text>
          </View>
        </ScrollView>
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
  headerSideBtn : { minWidth: 72 },
  headerCenter  : { flex: 1, alignItems: 'center', gap: 4 },
  cancelText    : { fontSize: 15, color: '#64748B', fontWeight: '400' },
  headerTitle   : { fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  districtBadge : {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: `${OLIVE}12`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  districtBadgeText: { fontSize: 11, color: OLIVE, fontWeight: '600' },
  publishBtn        : { alignItems: 'flex-end' },
  publishBtnDisabled: { opacity: 0.35 },
  publishText       : { fontSize: 15, color: OLIVE, fontWeight: '600' },

  divider: { height: 1, backgroundColor: 'rgba(226,232,240,0.8)' },
  scroll : { flex: 1 },

  // ── Empty media picker ──
  mediaPickerEmpty: {
    marginHorizontal: 20,
    marginTop: 24,
    height: SCREEN_WIDTH - 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mediaPickerIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${OLIVE}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaPickerLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  mediaPickerHint : { fontSize: 12, color: '#94A3B8', fontWeight: '400', textAlign: 'center', paddingHorizontal: 24 },

  // ── Media preview ──
  mediaPreviewWrap: { marginHorizontal: 20, marginTop: 24, gap: 12 },
  imagePreview    : { width: SCREEN_WIDTH - 40, borderRadius: 16, backgroundColor: '#E2E8F0' },
  videoWrap       : { width: SCREEN_WIDTH - 40, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0F172A' },
  videoFill       : { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  videoBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  mediaActions: { flexDirection: 'row', gap: 8 },
  mediaActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  mediaActionRemove: { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  mediaActionText  : { fontSize: 13, fontWeight: '500', color: OLIVE },

  // ── Title section ──
  titleSection: { paddingHorizontal: 20, paddingTop: 20 },
  titleLabel  : { fontSize: 12, fontWeight: '500', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  titleInput  : {
    fontSize: 15, color: '#0F172A', fontWeight: '400',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
  },
  charCount: { alignSelf: 'flex-end', fontSize: 11, color: '#CBD5E1', marginTop: 6 },
});

