import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OLIVE = '#4D7C0F';
const SLATE = '#94A3B8';

/**
 * Auth-aware Profile tab handler.
 * Logged-in  → /profile
 * Guest      → /auth
 */
async function handleProfileTabPress(router: ReturnType<typeof useRouter>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  router.push(user ? '/profile' : '/auth');
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: OLIVE,
        tabBarInactiveTintColor: SLATE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(226,232,240,0.8)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 24 : insets.bottom + 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 88 : insets.bottom + 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      {/* ── Tab 1: Nabız — newspaper (empty-state feed icon) ── */}
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

      {/* ── Tab 5: Profil — custom button, auth-aware navigation ── */}
      <Tabs.Screen
        name="create-post-trigger"
        options={{
          title: 'Profil',
          tabBarButton: () => (
            <TouchableOpacity
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.75}
              onPress={() => handleProfileTabPress(router)}
            >
              <Ionicons name="person-outline" size={24} color={SLATE} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: SLATE,
                  marginTop: 4,
                }}
              >
                Profil
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Hidden: agenda ── */}
      <Tabs.Screen
        name="agenda"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
