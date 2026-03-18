import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';

type SearchResult = {
  id        : string;
  username  : string;
  full_name : string | null;
  avatar_url: string | null;
  district  : string | null;
};

function getInitials(fullName: string | null, username: string) {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query,    setQuery   ] = useState('');
  const [results,  setResults ] = useState<SearchResult[]>([]);
  const [loading,  setLoading ] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search handler with debounce ──────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    // Strip leading @
    const cleanQuery = q.trim().replace(/^@/, '').toLowerCase();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, district')
      .ilike('username', `%${cleanQuery}%`)
      .limit(20);

    if (error) console.error('[Search]', error.message);
    setResults((data ?? []) as SearchResult[]);
    setLoading(false);
  }, []);

  function onQueryChange(text: string) {
    setQuery(text);
    // Debounce
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => handleSearch(text), 350);
  }

  function navigateToUser(username: string) {
    router.push({ pathname: '/user/[username]', params: { username } });
  }

  const renderItem = ({ item }: { item: SearchResult }) => {
    const initials = getInitials(item.full_name, item.username);
    return (
      <TouchableOpacity
        style={styles.resultItem}
        activeOpacity={0.75}
        onPress={() => navigateToUser(item.username)}
      >
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}

        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.full_name ?? item.username}</Text>
          <Text style={styles.resultUsername}>@{item.username}</Text>
          {item.district && (
            <View style={styles.districtChip}>
              <Ionicons name="location-outline" size={11} color="#94A3B8" />
              <Text style={styles.districtText}>{item.district}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanıcı Ara</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Search Input ── */}
      <View style={styles.searchBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Kullanıcı adı ile ara…"
            placeholderTextColor="#CBD5E1"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(query)}
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator size="small" color={OLIVE} style={styles.searchSpinner} />}
        </View>
      </View>

      {/* ── Results / Empty States ── */}
      {!searched && !query.trim() ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={52} color="#E2E8F0" />
          <Text style={styles.emptyTitle}>Kullanıcı Bul</Text>
          <Text style={styles.emptySub}>
            Kullanıcı adı ile arayın ve profillerine göz atın.
          </Text>
        </View>
      ) : searched && !loading && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#E2E8F0" />
          <Text style={styles.emptyTitle}>Sonuç Bulunamadı</Text>
          <Text style={styles.emptySub}>
            "<Text style={{ fontWeight: '600', color: '#64748B' }}>{query}</Text>" için kullanıcı bulunamadı.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsHeader}>
                {results.length} kullanıcı bulundu
              </Text>
            ) : null
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)',
    backgroundColor: 'rgba(249,250,251,0.95)',
  },
  backBtn     : { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  headerTitle : { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  headerSpacer: { width: 36 },

  searchBar  : { padding: 16, backgroundColor: 'rgba(249,250,251,0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.4)' },
  searchWrap : {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, height: 48,
    elevation: 2,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
    }),
  },
  searchIcon   : { marginRight: 8 },
  searchInput  : { flex: 1, fontSize: 15, color: '#0F172A', height: '100%' },
  searchSpinner: { marginLeft: 8 },

  listContent : { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 40 },
  resultsHeader: { fontSize: 12, color: '#94A3B8', fontWeight: '500', letterSpacing: 0.3, paddingVertical: 8, paddingHorizontal: 4 },
  separator   : { height: 1, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 4 },

  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  avatar        : { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    backgroundColor: `${OLIVE}22`, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: `${OLIVE}30`,
  },
  avatarInitials: { fontSize: 18, fontWeight: '700', color: OLIVE },
  resultInfo    : { flex: 1, gap: 2 },
  resultName    : { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  resultUsername: { fontSize: 13, color: '#94A3B8', fontWeight: '400' },
  districtChip  : { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  districtText  : { fontSize: 11, color: '#94A3B8', fontWeight: '400' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8', letterSpacing: -0.3 },
  emptySub  : { fontSize: 14, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },
});

