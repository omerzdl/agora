/**
 * StoryViewer.tsx
 *
 * Full-screen, Instagram-style story viewer.
 *
 * Features
 * ─────────
 * • Progress bars: one per story, fills over STORY_DURATION (10 s). Completed
 *   bars stay full-white; upcoming bars are empty (transparent track visible).
 * • Auto-advance: Animated.timing fires handleNext when the bar completes.
 * • Video support: expo-av Video (muted, shouldPlay, no loop).
 *   `onPlaybackStatusUpdate` advances early when the clip finishes.
 * • Image support: expo-image, contentFit="cover", fills the whole screen.
 * • Tap zones: left-third → prev · right-two-thirds → next.
 * • Top-left district label, top-right Kapat (×) button.
 * • Top + bottom gradient overlays for readability.
 * • Double-advance guard: `hasAdvanced` ref prevents two concurrent timers
 *   (Animated callback + video didJustFinish) from both firing.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// ─── Constants ────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('screen');
const STORY_DURATION = 10_000; // ms

// ─── Types ────────────────────────────────────────────────────────────────────
export type Story = {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  district: string;
  title: string | null;
  created_at: string;
};

interface Props {
  stories: Story[];
  initialIndex?: number;
  district: string;
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StoryViewer({
  stories,
  initialIndex = 0,
  district,
  visible,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? 28 : 0);

  // ── Current story index ──
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // ── Progress animation (0 → 1 over STORY_DURATION) ──
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef      = useRef<Animated.CompositeAnimation | null>(null);

  // ── Guards against double-advance ──
  const hasAdvanced = useRef(false);

  // ── Video ref ──
  const videoRef = useRef<Video>(null);

  // ── Derived ──
  const total        = stories.length;
  const currentStory = stories[currentIndex] ?? null;
  const isVideo      = currentStory?.media_type === 'video';

  // ── Advance to next story (or close when exhausted) ──────────────────────
  const handleNext = useCallback(() => {
    if (hasAdvanced.current) return;
    hasAdvanced.current = true;
    animRef.current?.stop();

    setCurrentIndex((prev) => {
      if (prev < total - 1) return prev + 1;
      // last story → close after a micro-tick so state settles
      setTimeout(onClose, 0);
      return prev;
    });
  }, [total, onClose]);

  // ── Go to previous story (or restart current if on first) ────────────────
  const handlePrev = useCallback(() => {
    animRef.current?.stop();
    hasAdvanced.current = false;
    progressAnim.setValue(0);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, [progressAnim]);

  // ── Start / restart the progress animation ────────────────────────────────
  const startProgress = useCallback(() => {
    hasAdvanced.current = false;
    progressAnim.setValue(0);
    animRef.current?.stop();

    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false, // 'width' cannot use native driver
    });

    animRef.current.start(({ finished }) => {
      if (finished) handleNext();
    });
  }, [progressAnim, handleNext]);

  // ── Re-start progress whenever currentIndex or visibility changes ─────────
  useEffect(() => {
    if (!visible || total === 0) return;
    startProgress();
    return () => {
      animRef.current?.stop();
    };
  }, [visible, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset index when the modal is (re-)opened ─────────────────────────────
  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { animRef.current?.stop(); }, []);

  if (!currentStory) return null;

  // ── Progress bar width style for the current slide ────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange : [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Force status bar hidden inside the viewer */}
      <StatusBar hidden />

      <View style={styles.container}>
        {/* ── Full-screen media ── */}
        {isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: currentStory.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isMuted={true}
            isLooping={false}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (
                status.isLoaded &&
                status.didJustFinish &&
                !hasAdvanced.current
              ) {
                handleNext();
              }
            }}
          />
        ) : (
          <Image
            source={{ uri: currentStory.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
          />
        )}

        {/* ── Top gradient scrim ── */}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.0)']}
          style={[styles.gradientTop, { height: safeTop + 100 }]}
          pointerEvents="none"
        />

        {/* ── Bottom gradient scrim ── */}
        <LinearGradient
          colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.5)']}
          style={styles.gradientBottom}
          pointerEvents="none"
        />

        {/* ── Progress bars ── */}
        <View style={[styles.progressRow, { top: safeTop + 10 }]}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              {i < currentIndex ? (
                // Completed — fully white
                <View style={[styles.progressFill, { width: '100%' }]} />
              ) : i === currentIndex ? (
                // Active — animates left→right
                <Animated.View
                  style={[styles.progressFill, { width: progressWidth }]}
                />
              ) : null /* Upcoming — track only */}
            </View>
          ))}
        </View>

        {/* ── Top chrome: district + close ── */}
        <View style={[styles.topChrome, { top: safeTop + 22 }]}>
          {/* District pill */}
          <View style={styles.districtPill}>
            <Ionicons name="location" size={13} color="#FFFFFF" />
            <Text style={styles.districtText}>{district}</Text>
          </View>

          {/* Kapat (×) */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Story title (bottom-left) ── */}
        {currentStory.title ? (
          <View style={[styles.titleWrap, { bottom: Math.max(insets.bottom, 24) + 16 }]}>
            {isVideo && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={11} color="#fff" />
                <Text style={styles.videoBadgeText}>Video</Text>
              </View>
            )}
            <Text style={styles.titleText}>{currentStory.title}</Text>
          </View>
        ) : null}

        {/* ── Tap zones (prev / next) ── */}
        {/* These sit ABOVE media but BELOW chrome; `pointerEvents` on the
            container lets chrome buttons receive their own touches. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={handlePrev}>
            <View style={styles.tapLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={handleNext}>
            <View style={styles.tapRight} />
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SW,
    height: SH,
    backgroundColor: '#000000',
  },

  // ── Gradient overlays ──
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },

  // ── Progress row ──
  progressRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  // ── Top chrome ──
  topChrome: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  districtPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.30)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  districtText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 19,
  },

  // ── Title overlay ──
  titleWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    gap: 8,
    zIndex: 10,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.50)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // ── Tap zones ──
  tapLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW * 0.33,
    height: SH,
  },
  tapRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SW * 0.67,
    height: SH,
  },
});

