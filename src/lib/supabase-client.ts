import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from env if present
const DEFAULT_URL = (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL || '';
const DEFAULT_ANON_KEY = (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;
let activeUrl = DEFAULT_URL;
let activeKey = DEFAULT_ANON_KEY;

export function getSupabaseConfig() {
  return {
    url: activeUrl,
    key: activeKey,
    hasConfig: Boolean(activeUrl && activeKey && activeUrl.startsWith('http')),
  };
}

export function initSupabase(url: string, anonKey: string): SupabaseClient | null {
  activeUrl = url.trim();
  activeKey = anonKey.trim();
  if (activeUrl && activeKey && activeUrl.startsWith('http')) {
    try {
      client = createClient(activeUrl, activeKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return client;
    } catch (e) {
      console.error('Supabase initialization error:', e);
      client = null;
      return null;
    }
  }
  client = null;
  return null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!client && activeUrl && activeKey && activeUrl.startsWith('http')) {
    return initSupabase(activeUrl, activeKey);
  }
  return client;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return { success: false, message: 'URL must start with https:// or http://' };
    }
    const testClient = createClient(url, key);
    const { error } = await testClient.from('battles').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it will return error 42P01, which still proves Supabase reached!
      if (error.message.includes('relation "public.battles" does not exist')) {
        return {
          success: true,
          message: 'Connected to Supabase! (Tables not yet created - run the SQL migration below).',
        };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Connected successfully to live Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection failed' };
  }
}
