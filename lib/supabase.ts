// Must be the very first import — patches the global URL/URLSearchParams
// so that the Supabase JS client works correctly in React Native.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmjadmzsprqieobjjjbr.supabase.co';
const supabaseAnonKey =
  'sb_publishable_HhFxwoADLQwVEkJw9w005A_vdlGLzLk';

// ─── Developer / Admin Account ────────────────────────────────────────────────
// This e-mail bypasses all guest-mode restrictions automatically because the
// user has an active session; we export it so every auth-guard can be explicit.
export const ADMIN_EMAIL = 'merhaba@praksis.tech';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Artık hafızaya kaydedecek
    autoRefreshToken: true,
    persistSession: true,   // Oturumu kalıcı yap
    detectSessionInUrl: false,
  },
});
