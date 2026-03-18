import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { useDistrict } from '@/lib/DistrictContext';
import { supabase } from '@/lib/supabase';

const CYAN = '#22D3EE';
const CORAL = '#F43F5E';
const BG = '#0D0F1A';

type FeedRow = {
  id: string;
  image: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  created_at: string | null;
  district: string | null;
};

const EVENT_KEYS = ['konser', 'tiyatro', 'atolye', 'atölye', 'pazar', 'etkinlik'];

function formatDate(value: string | null) {
  if (!value) return 'Tarih yakında';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Tarih yakında';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(parsed));
}

function formatTimeAgo(value: string | null) {
  if (!value) return 'Az önce';
  const diffSec = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diffSec < 60) return 'Az önce';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function looksLikeEvent(category: string | null) {
  if (!category) return false;
  const lower = category.toLocaleLowerCase('tr-TR');
  return EVENT_KEYS.some((key) => lower.includes(key));
}

export default function HomeTabScreen() {
  const router = useRouter();
  const { selectedDistrict } = useDistrict();

  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHomeData = useCallback(async () => {
    try {
      const [feedRes, jobsRes] = await Promise.all([
        supabase
          .from('feed')
          .select('id, image, title, description, category, created_at, district')
          .eq('district', selectedDistrict)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('district', selectedDistrict)
          .limit(20),
      ]);

      setFeed((feedRes.data as FeedRow[] | null) ?? []);
      setJobsCount(jobsRes.count ?? 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDistrict]);

  React.useEffect(() => {
    setLoading(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const heroEvent = useMemo(() => feed.find((item) => looksLikeEvent(item.category)) ?? null, [feed]);
  const headlines = useMemo(() => feed.filter((item) => !looksLikeEvent(item.category)).slice(0, 2), [feed]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <StatusBar style="light" />
        <ActivityIndicator size="small" color={CYAN} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#071626', '#0E1222', '#080B15']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} />}
      >
        <View style={styles.weatherCard}>
          <View>
            <View style={styles.tempRow}>
              <Text style={styles.tempText}>28°C</Text>
              <Text style={styles.tempState}>Açık</Text>
            </View>
            <Text style={styles.airText}>Hava Kalitesi: 42 (Excellent)</Text>
          </View>
          <View style={styles.sunWrap}>
            <Ionicons name="sunny" size={48} color={CYAN} />
            <View style={styles.sunDot} />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.heroCard}
          onPress={() =>
            heroEvent
              ? router.push({
                  pathname: '/post/[id]',
                  params: { id: heroEvent.id, postData: JSON.stringify(heroEvent) },
                })
              : router.push('/explore')
          }
        >
          {heroEvent?.image ? (
            <Image source={{ uri: heroEvent.image }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#21334A', '#121928']} style={styles.heroImageFallback} />
          )}
          <LinearGradient colors={['transparent', 'rgba(8,12,20,0.9)']} style={styles.heroOverlay} />
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE NOW</Text>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {heroEvent?.title ?? `${selectedDistrict} Etkinlikleri`}
            </Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="calendar-outline" size={14} color={CYAN} />
              <Text style={styles.heroMetaText}>{formatDate(heroEvent?.created_at ?? null)}</Text>
              <Ionicons name="location-outline" size={14} color={CYAN} />
              <Text style={styles.heroMetaText}>{selectedDistrict}</Text>
            </View>
            <Text style={styles.heroDesc} numberOfLines={2}>
              {heroEvent?.description ?? 'Bölgedeki öne çıkan etkinlikleri tek ekranda keşfet.'}
            </Text>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText}>Biletleri Gör</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.85} onPress={() => router.push('/career')}>
            <View style={styles.quickIconWrap}>
              <Ionicons name="briefcase-outline" size={18} color={CYAN} />
            </View>
            <Text style={styles.quickCount}>{jobsCount}</Text>
            <Text style={styles.quickLabel}>AKTIF ILAN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} activeOpacity={0.85} onPress={() => router.push('/explore')}>
            <View style={[styles.quickIconWrap, styles.quickIconWrapCoral]}>
              <Ionicons name="trending-up-outline" size={18} color={CORAL} />
            </View>
            <Text style={styles.quickHeadline}>Yeni Etkinlik Akisi</Text>
            <Text style={styles.quickSub}>KESFET</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Yerel Gündem</Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={styles.sectionAction}>Tümünü Gör</Text>
          </TouchableOpacity>
        </View>

        {headlines.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{selectedDistrict} için henüz manşet yok.</Text>
          </View>
        ) : (
          headlines.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.headlineCard}
              activeOpacity={0.86}
              onPress={() =>
                router.push({
                  pathname: '/post/[id]',
                  params: { id: item.id, postData: JSON.stringify(item) },
                })
              }
            >
              <View style={styles.thumbWrap}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumbImage} contentFit="cover" />
                ) : (
                  <LinearGradient colors={['#1B2A43', '#11182A']} style={styles.thumbImage} />
                )}
              </View>
              <View style={styles.headlineBody}>
                <Text style={styles.headlineTitle} numberOfLines={2}>
                  {item.title ?? 'Yerel haber'}
                </Text>
                <Text style={styles.headlineMeta}>
                  {formatTimeAgo(item.created_at)} • {item.category ?? 'Genel'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 120, gap: 14 },

  weatherCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(25,34,56,0.58)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tempText: { color: '#EDF4FF', fontSize: 38, fontWeight: '800', letterSpacing: -0.8 },
  tempState: { color: CYAN, fontSize: 18, fontWeight: '600' },
  airText: { color: '#A7BAD7', fontSize: 12, marginTop: 2 },
  sunWrap: { position: 'relative' },
  sunDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: CORAL,
  },

  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(22,30,50,0.62)',
  },
  heroImage: { width: '100%', height: 188 },
  heroImageFallback: { width: '100%', height: 188 },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  liveBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(244,63,94,0.88)',
  },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  heroBody: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  heroTitle: { color: '#F6FAFF', fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
  heroMetaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { color: '#BBD0EC', fontSize: 12, marginRight: 6 },
  heroDesc: { marginTop: 8, color: '#D2DEEF', fontSize: 13, lineHeight: 18 },
  ctaButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  ctaText: { color: CYAN, fontSize: 15, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(24,33,54,0.58)',
    padding: 14,
    minHeight: 126,
    justifyContent: 'space-between',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.14)',
  },
  quickIconWrapCoral: { backgroundColor: 'rgba(244,63,94,0.14)' },
  quickCount: { color: '#ECF4FF', fontSize: 35, fontWeight: '800', letterSpacing: -0.7 },
  quickLabel: { color: '#9AB0D0', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  quickHeadline: { color: '#ECF4FF', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  quickSub: { color: CORAL, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sectionHead: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: { color: '#EBF3FF', fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  sectionAction: { color: CYAN, fontSize: 14, fontWeight: '700' },

  headlineCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(24,33,54,0.58)',
    padding: 10,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(44,58,90,0.66)',
  },
  thumbImage: { width: '100%', height: '100%' },
  headlineBody: { flex: 1, minWidth: 0 },
  headlineTitle: { color: '#F3F8FF', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  headlineMeta: { color: '#9FB3D1', fontSize: 12, marginTop: 3 },

  emptyCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(24,33,54,0.58)',
    padding: 18,
    alignItems: 'center',
  },
  emptyText: { color: '#A6BAD8', fontSize: 13 },
});
