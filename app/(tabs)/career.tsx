import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { useDistrict } from '@/lib/DistrictContext';
import { supabase } from '@/lib/supabase';

const BG = '#0D0F1A';
const CARD = 'rgba(23,31,51,0.62)';
const TEXT_PRIMARY = '#EDF4FF';
const TEXT_SECONDARY = '#93A8C8';
const OLIVE = '#22D3EE';
const OLIVE_BG = 'rgba(34,211,238,0.14)';

type JobTypeTab = 'Tam Zamanlı' | 'Yarı Zamanlı';

type JobRow = Record<string, unknown>;

type JobItem = {
  id: string;
  title: string;
  company: string;
  company_logo_url: string | null;
  location: string | null;
  district: string | null;
  sector: string;
  job_type: string;
  description: string;
  salary_info: string | null;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string | null;
};

function pickString(row: JobRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function pickNumber(row: JobRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeJob(row: JobRow): JobItem {
  const idRaw = row.id;
  const createdAt = pickString(row, 'created_at');
  return {
    id: typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : String(idRaw ?? createdAt ?? Math.random()),
    title: pickString(row, 'title', 'job_title', 'position') ?? 'Pozisyon',
    company: pickString(row, 'company_name', 'company') ?? 'Şirket bilgisi yok',
    company_logo_url: pickString(row, 'company_logo_url', 'logo_url', 'company_logo'),
    location: pickString(row, 'location', 'workplace', 'address'),
    district: pickString(row, 'district'),
    sector: pickString(row, 'sector', 'category') ?? 'Genel',
    job_type: pickString(row, 'job_type', 'employment_type') ?? 'Belirtilmedi',
    description: pickString(row, 'description', 'job_description', 'details', 'content') ?? '',
    salary_info: pickString(row, 'salary_info', 'salary_text'),
    salary_min: pickNumber(row, 'salary_min', 'min_salary'),
    salary_max: pickNumber(row, 'salary_max', 'max_salary'),
    created_at: createdAt,
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getSalaryLabel(job: JobItem) {
  if (job.salary_min != null && job.salary_max != null) {
    return `${formatMoney(job.salary_min)} - ${formatMoney(job.salary_max)}`;
  }
  if (job.salary_min != null) return `${formatMoney(job.salary_min)}+`;
  if (job.salary_info) return job.salary_info;
  return 'Maaş görüşmede';
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(parsed));
}

function JobCard({ item, onPress }: { item: JobItem; onPress: () => void }) {
  const postedDate = formatDate(item.created_at);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={onPress}>
      <Image
        source={item.company_logo_url ? { uri: item.company_logo_url } : require('@/assets/images/icon.png')}
        style={styles.logo}
        contentFit="cover"
      />

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.companyText}>
          {item.company}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color="#94A3B8" />
          <Text numberOfLines={1} style={styles.metaText}>
            {item.location ?? item.district ?? 'Konum belirtilmedi'}
          </Text>
          {postedDate ? <Text style={styles.metaDot}>•</Text> : null}
          {postedDate ? <Text style={styles.metaText}>{postedDate}</Text> : null}
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {item.job_type}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {item.sector}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {getSalaryLabel(item)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CareerScreen() {
  const router = useRouter();
  const { selectedDistrict } = useDistrict();

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [activeJobType, setActiveJobType] = useState<JobTypeTab>('Tam Zamanlı');

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('jobs')
        .select('*')
        .eq('district', selectedDistrict)
        .order('created_at', { ascending: false })
        .limit(20);

      if (queryError) throw queryError;

      const nextJobs = Array.isArray(data) ? data.map((row) => normalizeJob((row ?? {}) as JobRow)) : [];
      setJobs(nextJobs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'İlanlar yüklenemedi.';
      setError(message);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDistrict]);

  React.useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  const jobTypes: JobTypeTab[] = ['Tam Zamanlı', 'Yarı Zamanlı'];

  const normalizeJobType = useCallback((value: string) => {
    const lower = value.toLocaleLowerCase('tr-TR');
    if (lower.includes('tam')) return 'Tam Zamanlı';
    if (lower.includes('yar') || lower.includes('part')) return 'Yarı Zamanlı';
    return null;
  }, []);

  const filteredJobs = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('tr-TR');
    const base = jobs.filter((item) => {
      if (normalizeJobType(item.job_type) !== activeJobType) return false;

      if (!query) return true;
      const searchable = `${item.title} ${item.company} ${item.description}`.toLocaleLowerCase('tr-TR');
      return searchable.includes(query);
    });
    return base;
  }, [activeJobType, jobs, normalizeJobType, searchText]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.topSection}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={17} color="#94A3B8" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            placeholder="Pozisyon, şirket veya açıklama ara"
            placeholderTextColor="#94A3B8"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText ? (
            <TouchableOpacity activeOpacity={0.75} onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {jobTypes.map((type) => {
            const active = activeJobType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.85}
                onPress={() => setActiveJobType(type)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{type}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kariyer</Text>
        <Text style={styles.sectionCount}>{filteredJobs.length} ilan</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={OLIVE} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={30} color="#F43F5E" />
          <Text style={styles.errorTitle}>İlanlar yüklenemedi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={fetchJobs}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : filteredJobs.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="briefcase-outline" size={36} color="#94A3B8" />
          <Text style={styles.emptyTitle}>İlan bulunamadı</Text>
          <Text style={styles.emptyText}>
            {selectedDistrict} için seçili iş tipi filtresine uygun ilan bulunmuyor.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JobCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/post/[id]',
                  params: {
                    id: item.id,
                    postData: JSON.stringify({
                      ...item,
                      image: item.company_logo_url,
                      media_type: null,
                      category: 'Kariyer',
                      category_color: OLIVE,
                      created_at: item.created_at ?? new Date().toISOString(),
                      description: item.description || `${item.company} - ${item.title}`,
                    }),
                  },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  topSection: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  searchWrap: {
    marginHorizontal: 16,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(31,42,68,0.72)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: '0px 8px 18px rgba(0,0,0,0.22)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 0,
      },
    }),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#E4EEFC',
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(31,42,68,0.72)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: OLIVE_BG,
  },
  filterChipText: {
    color: '#8DA4C7',
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
    paddingBottom: 24,
  },
  separator: {
    height: 10,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0px 14px 28px rgba(0, 0, 0, 0.28)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 0,
      },
    }),
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: 'rgba(42,55,86,0.7)',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  companyText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: '#A3B7D6',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#94AACB',
    fontSize: 12,
    flexShrink: 1,
  },
  metaDot: {
    color: '#6C82A4',
    fontSize: 12,
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: OLIVE_BG,
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
    color: '#93A8C8',
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
    color: '#93A8C8',
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
