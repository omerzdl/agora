import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
      <Text style={styles.title}>Ajanda</Text>
      <Text style={styles.subtitle}>Yakında</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  },
});

