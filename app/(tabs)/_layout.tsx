import { supabase } from '@/lib/supabase';
import { useDistrict, DISTRICTS, District } from '@/lib/DistrictContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

const CYAN = '#22D3EE';
const CORAL = '#F43F5E';
const BG = '#0D0F1A';
const GLASS = 'rgba(14,18,32,0.55)';

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
      <LinearGradient
        colors={['#071626', '#0E1222', '#080B15']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Status bar spacer ── */}
      <View style={{ height: insets.top }} />

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
                      style={[styles.dropdownItem, !isLast && styles.dropdownItemSpacing]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedDistrict(item as District);
                        setDistrictDropdownOpen(false);
                      }}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <Ionicons name="location-outline" size={18} color={isActive ? CYAN : '#7B8AA6'} />
                        <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemActive]}>
                          {item}
                        </Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={18} color={CYAN} />}
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
            <Ionicons name="location-outline" size={16} color={CYAN} />
            <Text style={styles.locationText}>{selectedDistrict}</Text>
            <Ionicons name="chevron-down" size={14} color="#8FA5C8" />
          </TouchableOpacity>
        </View>

        {/* Right: Notifications */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.headerIconWrap}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search-outline" size={22} color="#B8C7DE" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.headerIconWrap}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={CORAL} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ── */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: CYAN,
          tabBarInactiveTintColor: '#8FA5C8',
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: Platform.OS === 'web' ? Math.max(insets.bottom, 12) : insets.bottom + 8,
            height: 72,
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            elevation: 0,
            paddingTop: 10,
            paddingBottom: 10,
          },
          tabBarItemStyle: { borderRadius: 999 },
          tabBarBackground: () => (
            <View style={styles.tabBarIsland}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['rgba(35,57,86,0.46)', 'rgba(15,21,38,0.75)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          ),
        }}
      >
        {/* ── Tab 1: Anasayfa ── */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Anasayfa',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
                <Ionicons name="home" size={22} color={color} />
              </View>
            ),
          }}
        />

        {/* ── Tab 2: Nabız ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Nabız',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
                <Ionicons name="newspaper-outline" size={21} color={color} />
              </View>
            ),
          }}
        />

        {/* ── Tab 3: Etkinlikler ── */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Etkinlikler',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
                <Ionicons name="calendar-clear-outline" size={21} color={color} />
              </View>
            ),
          }}
        />

        {/* ── Tab 4: Kariyer ── */}
        <Tabs.Screen
          name="career"
          options={{
            title: 'Kariyer',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
                <Ionicons name="briefcase-outline" size={21} color={color} />
              </View>
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
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
                <Ionicons name="person-outline" size={21} color={color} />
              </View>
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
    backgroundColor: 'rgba(9,14,26,0.72)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    ...Platform.select({
      web: { backdropFilter: 'blur(20px)' },
      default: {},
    }),
  },
  headerLogoWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(39,55,84,0.5)',
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    backgroundColor: 'rgba(26,36,58,0.68)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E5EDF9',
    letterSpacing: -0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconWrap: {
    position: 'relative',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(26,36,58,0.52)',
  },

  // ── Dropdown Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,8,20,0.66)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dropdownCard: {
    backgroundColor: GLASS,
    borderRadius: 24,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 10,
    elevation: 0,
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 40px rgba(0,0,0,0.42)',
        backdropFilter: 'blur(24px)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.34,
        shadowRadius: 26,
      },
    }),
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9FB2D1',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(35,48,75,0.62)',
  },
  dropdownItemSpacing: {
    marginBottom: 8,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#D9E3F2',
  },
  dropdownItemActive: {
    fontWeight: '700',
    color: CYAN,
  },
  tabBarIsland: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,28,46,0.33)',
    ...Platform.select({
      web: { boxShadow: '0px 16px 36px rgba(0,0,0,0.45)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapFocused: {
    backgroundColor: 'rgba(34,211,238,0.14)',
    ...Platform.select({
      web: { boxShadow: '0px 0px 18px rgba(34,211,238,0.48)' },
      default: {
        shadowColor: CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.58,
        shadowRadius: 14,
      },
    }),
  },
});
