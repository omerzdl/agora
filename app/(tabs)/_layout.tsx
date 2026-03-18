import { supabase } from '@/lib/supabase';
import { useDistrict, DISTRICTS, District } from '@/lib/DistrictContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';

function blurWebFocusBeforeNavigation() {
  if (Platform.OS !== 'web') return;
  const active = globalThis.document?.activeElement as HTMLElement | null | undefined;
  if (active && typeof active.blur === 'function') {
    active.blur();
  }
}

async function handleProfileTabPress(router: ReturnType<typeof useRouter>) {
  blurWebFocusBeforeNavigation();
  const { data: { user } } = await supabase.auth.getUser();
  router.push(user ? '/profile' : '/auth');
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { selectedDistrict, setSelectedDistrict } = useDistrict();
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Status bar spacer ── */}
      <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} />

      {/* ── District Dropdown Modal ── */}
      <Modal
        visible={districtDropdownOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDistrictDropdownOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDistrictDropdownOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownCard}>
                <Text style={styles.dropdownTitle}>Bölge Seç</Text>
                {DISTRICTS.map((item, i) => {
                  const isLast   = i === DISTRICTS.length - 1;
                  const isActive = item === selectedDistrict;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.dropdownItem, !isLast && styles.dropdownItemBorder]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedDistrict(item as District);
                        setDistrictDropdownOpen(false);
                      }}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <Ionicons name="location-outline" size={18} color={isActive ? OLIVE : '#94A3B8'} />
                        <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemActive]}>
                          {item}
                        </Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={18} color={OLIVE} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Shared Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLogoWrap}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.headerLogo}
            contentFit="cover"
          />
        </View>

        {/* Center: District Selector */}
        <View style={[styles.headerCenter, { pointerEvents: 'box-none' }]}>
          <TouchableOpacity
            style={styles.locationBtn}
            activeOpacity={0.75}
            onPress={() => setDistrictDropdownOpen(true)}
          >
            <Ionicons name="location-outline" size={16} color={OLIVE} />
            <Text style={styles.locationText}>{selectedDistrict}</Text>
            <Ionicons name="chevron-down" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Right: Notifications */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.headerIconWrap}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ── */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: OLIVE,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: 'rgba(226,232,240,0.8)',
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? 24 : Platform.OS === 'web' ? insets.bottom + 6 : insets.bottom + 10,
            paddingTop: 10,
            height: Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? insets.bottom + 82 : insets.bottom + 68,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 2,
          },
        }}
      >
        {/* ── Tab 1: Nabız ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Nabız',
            tabBarIcon: ({ color }) => (
              <Ionicons name="newspaper-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 2: Etkinlikler ── */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Etkinlikler',
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-clear-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 3: Kariyer ── */}
        <Tabs.Screen
          name="career"
          options={{
            title: 'Kariyer',
            tabBarIcon: ({ color }) => (
              <Ionicons name="briefcase-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 4: Çarşı ── */}
        <Tabs.Screen
          name="market"
          options={{
            title: 'Çarşı',
            tabBarIcon: ({ color }) => (
              <Ionicons name="cart-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 5: Profil ── */}
        <Tabs.Screen
          name="create-post-trigger"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              void handleProfileTabPress(router);
            },
          }}
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Hidden: agenda ── */}
        <Tabs.Screen
          name="agenda"
          options={{ href: null }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerLogoWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Dropdown Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    elevation: 20,
    ...Platform.select({
      web: { boxShadow: '0px 12px 24px rgba(0,0,0,0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
    }),
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1E293B',
  },
  dropdownItemActive: {
    fontWeight: '600',
    color: OLIVE,
  },
});
