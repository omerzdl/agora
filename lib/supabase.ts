// Must be the very first import — patches the global URL/URLSearchParams
// so that the Supabase JS client works correctly in React Native.
import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmjadmzsprqieobjjjbr.supabase.co';
const supabaseAnonKey =
  'sb_publishable_HhFxwoADLQwVEkJw9w005A_vdlGLzLk';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// SSR/web ilk yükleme sırasında `window` yokken patlamaması için bellek içi fallback.
const memoryStorageAdapter: StorageAdapter = (() => {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
})();

const webLocalStorageAdapter: StorageAdapter = {
  async getItem(key) {
    if (typeof window === 'undefined') return memoryStorageAdapter.getItem(key);
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    if (typeof window === 'undefined') return memoryStorageAdapter.setItem(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore write failures (e.g. storage quota / disabled cookies)
    }
  },
  async removeItem(key) {
    if (typeof window === 'undefined') return memoryStorageAdapter.removeItem(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore remove failures
    }
  },
};

const asyncStorageAdapter: StorageAdapter = {
  async getItem(key) {
    const { default: AsyncStorage } = await import(
      '@react-native-async-storage/async-storage'
    );
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    const { default: AsyncStorage } = await import(
      '@react-native-async-storage/async-storage'
    );
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    const { default: AsyncStorage } = await import(
      '@react-native-async-storage/async-storage'
    );
    await AsyncStorage.removeItem(key);
  },
};

const storage: StorageAdapter = Platform.OS === 'web' ? webLocalStorageAdapter : asyncStorageAdapter;

// ─── Developer / Admin Account ────────────────────────────────────────────────
// This e-mail bypasses all guest-mode restrictions automatically because the
// user has an active session; we export it so every auth-guard can be explicit.
export const ADMIN_EMAIL = 'merhaba@praksis.tech';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage, // Web: window.localStorage (SSR: memory), Mobil: AsyncStorage
    autoRefreshToken: true,
    persistSession: true,   // Oturumu kalıcı yap
    detectSessionInUrl: false,
  },
});
