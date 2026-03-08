import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useDistrict, DISTRICTS, District } from '@/lib/DistrictContext';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';

// ─── Reusable Dropdown ────────────────────────────────────────────────────────
function DropdownModal<T extends string>({
  visible,
  items,
  selected,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean;
  items: readonly T[];
  selected: T;
  onSelect: (item: T) => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dropdownCard}>
              <Text style={styles.dropdownTitle}>{title}</Text>
              {items.map((item, index) => {
                const isLast   = index === items.length - 1;
                const isActive = item === selected;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.dropdownItem, !isLast && styles.dropdownItemBorder]}
                    activeOpacity={0.7}
                    onPress={() => { onSelect(item); onClose(); }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isActive && styles.dropdownItemTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={18} color={OLIVE} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { selectedDistrict, setSelectedDistrict } = useDistrict();
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── District Dropdown Modal ── */}
      <DropdownModal
        visible={districtDropdownOpen}
        items={DISTRICTS}
        selected={selectedDistrict}
        onSelect={(d) => setSelectedDistrict(d as District)}
        onClose={() => setDistrictDropdownOpen(false)}
        title="Bölge Seç"
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.locationBtn}
          activeOpacity={0.75}
          onPress={() => setDistrictDropdownOpen(true)}
        >
          <Ionicons name="location-outline" size={18} color={OLIVE} />
          <Text style={styles.locationText}>{selectedDistrict}</Text>
          <Ionicons name="chevron-down" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ── Placeholder ── */}
      <View style={styles.body}>
        <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
        <Text style={styles.title}>Etkinlikler</Text>
        <Text style={styles.subtitle}>{selectedDistrict} etkinlikleri yakında burada</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ──
  header: {
    backgroundColor: 'rgba(249,250,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  // ── Body ──
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 32,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
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
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1E293B',
  },
  dropdownItemTextActive: {
    fontWeight: '600',
    color: OLIVE,
  },
});
