import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface ArtifactVersion {
  id: number;
  project_id: number;
  thread_id: number;
  v: number;
  kind: string;
  uri: string;
  summary: string;
  delta: string;
  created_by: string;
  embedding?: number[];
  tags?: string;
  created_at: string;
}
