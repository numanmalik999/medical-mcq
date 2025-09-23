import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Client Init - URL:', supabaseUrl ? 'Loaded' : 'UNDEFINED');
console.log('Supabase Client Init - Anon Key:', supabaseAnonKey ? 'Loaded' : 'UNDEFINED');

if (!supabaseUrl || !supabaseAnonKey) {
  // This error should now be visible in the console if variables are missing
  throw new Error('Supabase URL and Anon Key are required! Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);