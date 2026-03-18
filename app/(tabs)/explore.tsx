import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { useDistrict } from '@/lib/DistrictContext';
import { supabase } from '@/lib/supabase';

const BG = '#F8F9FA';
const CARD = '#FFFFFF';
const OLIVE = '#4D7C0F';
const OLIVE_BG = 'rgba(77,124,15,0.10)';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#64748B';

const EVENT_CATEGORIES = ['Konser', 'Tiyatro', 'Atölye', 'Pazar'] as const;
type EventFilter = 'Tümü' | (typeof EVENT_CATEGORIES)[number];

type FeedRow = {
  id: string;
  image: string | null;
  media_type: string | null;
  category: string | null;
  category_color: string | null;
  title: string | null;
  description: string | null;
  created_at: string | null;
  district: string | null;
};

type EventItem = {
  id: string;
  image: string | null;
  media_type: string | null;
  category: string;
  category_color: string;
  title: string;
  description: string;
  created_at: string | null;
  district: string | null;
};

function normalizeCategory(value: string | null) {
  if (!value) return null;
  const lower = value.toLocaleLowerCase('tr-TR');

  if (lower.includes('konser')) return 'Konser';
  if (lower.includes('tiyatro')) return 'Tiyatro';
  if (lower.includes('atolye') || lower.includes('atölye')) return 'Atölye';
  if (lower.includes('pazar')) return 'Pazar';
  return null;
}

function mapEventRow(row: FeedRow): EventItem | null {
  const normalizedCategory = normalizeCategory(row.category);
  if (!normalizedCategory) return null;

  return {
    id: String(row.id),
    image: row.image ?? null,
    media_type: row.media_type ?? null,
    category: normalizedCategory,
    category_color: row.category_color ?? OLIVE,
    title: row.title ?? 'Etkinlik',
    description: row.description ?? '',
    created_at: row.created_at ?? null,
    district: row.district ?? null,
  };
}

function formatEventDate(value: string | null) {
  if (!value) return 'Tarih belirtilmedi';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Tarih belirtilmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function EventCard({ item, onPress }: { item: EventItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={onPress}>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description || 'Etkinlik açıklaması yakında paylaşılacak.'}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
          <Text style={styles.metaText}>{formatEventDate(item.created_at)}</Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
          {item.district ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.district}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { selectedDistrict } = useDistrict();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<EventFilter>('Tümü');

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('feed')
        .select('id, image, media_type, category, category_color, title, description, created_at, district')
        .eq('district', selectedDistrict)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      const mapped =
        (data as FeedRow[] | null)
          ?.map((row) => mapEventRow(row))
          .filter((item): item is EventItem => item !== null) ?? [];

      setEvents(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Etkinlikler yüklenemedi.';
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDistrict]);

  React.useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'Tümü') return events;
    return events.filter((item) => item.category === activeFilter);
  }, [activeFilter, events]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'Tümü' && styles.filterChipActive]}
            activeOpacity={0.85}
            onPress={() => setActiveFilter('Tümü')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'Tümü' && styles.filterChipTextActive]}>Tümü</Text>
          </TouchableOpacity>

          {EVENT_CATEGORIES.map((category) => {
            const active = activeFilter === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.85}
                onPress={() => setActiveFilter(category)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Etkinlikler</Text>
        <Text style={styles.sectionCount}>{filteredEvents.length} etkinlik</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={OLIVE} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={30} color="#E11D48" />
          <Text style={styles.errorTitle}>Etkinlikler yüklenemedi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={fetchEvents}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="calendar-clear-outline" size={36} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Etkinlik bulunamadı</Text>
          <Text style={styles.emptyText}>
            {selectedDistrict} için seçilen kategoride etkinlik paylaşımı bulunmuyor.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/post/[id]',
                  params: { id: item.id, postData: JSON.stringify(item) },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OLIVE} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  filterSection: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2F5',
  },
  filterChipActive: {
    backgroundColor: OLIVE_BG,
  },
  filterChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: OLIVE,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionCount: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 26,
  },
  separator: {
    height: 10,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.06)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 2,
      },
    }),
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    lineHeight: 23,
  },
  cardDescription: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 12,
    flexShrink: 1,
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: OLIVE_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: OLIVE,
    fontSize: 11,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  errorTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: OLIVE_BG,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: OLIVE,
    fontSize: 12,
    fontWeight: '700',
  },
});
