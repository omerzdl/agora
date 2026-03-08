import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

// ─── Brand Colors ────────────────────────────────────────────────────────────
const OLIVE = '#4D7C0F';
const BG    = '#F9FAFB';
const RED   = '#EA580C';

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = 'friend_request' | 'like' | 'comment' | 'follow' | 'mention';

type NotifRow = {
  id         : string;
  type       : string;
  message    : string;
  read       : boolean;
  created_at : string;
  sender_id  : string | null;
  post_id    : string | null;
  profiles   : { username: string; avatar_url: string | null } | null;
};

type Notification = {
  id          : string;
  type        : NotifType;
  message     : string;
  senderUsername: string | null;
  postId      : string | null;
  timestamp   : string;
  read        : boolean;
};

// ─── Time-ago helper (Turkish) ────────────────────────────────────────────────
function timeAgo(dateString: string): string {
  const now     = new Date();
  const date    = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60)  return 'Az önce';
  const minutes = Math.floor(seconds / 60);
  if (minutes  < 60) return `${minutes} dakika önce`;
  const hours   = Math.floor(minutes / 60);
  if (hours    < 24) return `${hours} saat önce`;
  const days    = Math.floor(hours / 24);
  if (days === 1)    return 'Dün';
  if (days < 7)      return `${days} gün önce`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// ─── Icon config per type ─────────────────────────────────────────────────────
function getIconConfig(type: string): {
  name: React.ComponentProps<typeof Ionicons>['name'];
  bg: string;
  color: string;
} {
  switch (type) {
    case 'like':           return { name: 'heart',         bg: '#FEE2E2', color: '#EF4444' };
    case 'comment':        return { name: 'chatbubble',    bg: '#DBEAFE', color: '#3B82F6' };
    case 'friend_request':
    case 'follow':         return { name: 'person-add',    bg: `${OLIVE}20`, color: OLIVE };
    case 'mention':        return { name: 'at',            bg: '#FEF3C7', color: '#D97706' };
    default:               return { name: 'notifications', bg: '#F1F5F9', color: '#64748B' };
  }
}

// ─── Notification Item ────────────────────────────────────────────────────────
function NotifItem({
  item, onUserPress, onMarkRead,
}: {
  item: Notification;
  onUserPress: (username: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const icon = getIconConfig(item.type);

  return (
    <TouchableOpacity
      style={[styles.notifItem, !item.read && styles.notifItemUnread]}
      activeOpacity={0.75}
      onPress={() => onMarkRead(item.id)}
    >
      {!item.read && <View style={styles.unreadDot} />}

      <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={18} color={icon.color} />
      </View>

      <View style={styles.notifTextWrap}>
        <Text style={styles.notifText} numberOfLines={3}>
          {item.senderUsername ? (
            <Text
              style={styles.notifUsername}
              onPress={() => onUserPress(item.senderUsername!)}
            >
              @{item.senderUsername}{' '}
            </Text>
          ) : null}
          <Text>{item.message.replace(/^[^\s]+\s/, item.senderUsername ? '' : item.message)}</Text>
        </Text>
        <Text style={styles.notifTime}>{timeAgo(item.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading      ] = useState(true);

  // ── Load notifications from DB ─────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, read, created_at, sender_id, post_id, profiles:sender_id(username, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('[Notifications]', error.message);

    const mapped: Notification[] = (data ?? []).map((row: NotifRow) => {
      const sender = row.profiles as { username?: string } | null;
      return {
        id            : row.id,
        type          : row.type as NotifType,
        message       : row.message,
        senderUsername: sender?.username ?? null,
        postId        : row.post_id,
        timestamp     : row.created_at,
        read          : row.read,
      };
    });

    setNotifications(mapped);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadNotifications();
  }, [loadNotifications]));

  // ── Mark as read ──────────────────────────────────────────────────────────
  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }

  // ── Mark all read ─────────────────────────────────────────────────────────
  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread   = unreadCount > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.75} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#334155" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {hasUnread ? (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={markAllRead}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Tümünü Okundu</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={OLIVE} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={52} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
              <Text style={styles.emptySubtitle}>Etkileşimler burada görünecek</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {notifications.map((item, index) => {
                const isLastUnread =
                  index === notifications.length - 1 ||
                  notifications[index + 1]?.read !== item.read;

                return (
                  <React.Fragment key={item.id}>
                    <NotifItem
                      item={item}
                      onUserPress={(username) =>
                        router.push({ pathname: '/user/[username]', params: { username } })
                      }
                      onMarkRead={markRead}
                    />
                    {isLastUnread && !item.read && notifications.some((n) => n.read) && (
                      <View style={styles.groupDivider}>
                        <View style={styles.groupDividerLine} />
                        <Text style={styles.groupDividerText}>Daha önce</Text>
                        <View style={styles.groupDividerLine} />
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: 'rgba(249,250,251,0.96)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.6)',
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle : { fontSize: 17, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  countBadge  : {
    backgroundColor: RED, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  headerSpacer  : { width: 80 },
  markAllBtn    : { paddingHorizontal: 10, paddingVertical: 6 },
  markAllText   : { fontSize: 12, fontWeight: '600', color: OLIVE },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll        : { flex: 1 },
  listContainer : { paddingTop: 8 },

  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)',
  },
  notifItemUnread: { backgroundColor: `${OLIVE}08` },
  unreadDot: {
    position: 'absolute', left: 8, top: 22,
    width: 6, height: 6, borderRadius: 3, backgroundColor: OLIVE,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifTextWrap : { flex: 1, gap: 4 },
  notifText     : { fontSize: 14, color: '#334155', lineHeight: 20 },
  notifUsername : { fontWeight: '700', color: OLIVE },
  notifTime     : { fontSize: 12, color: '#94A3B8', fontWeight: '400' },

  groupDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  groupDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(226,232,240,0.8)' },
  groupDividerText: { fontSize: 12, fontWeight: '500', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyState: { paddingTop: 100, alignItems: 'center', gap: 12 },
  emptyTitle : { fontSize: 17, fontWeight: '600', color: '#94A3B8', letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 14, color: '#CBD5E1', fontWeight: '400' },
});
