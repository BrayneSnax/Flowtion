import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for TypeScript
export interface Project {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

export interface Thread {
  id: number;
  project_id: number;
  created_at: string;
}

export interface Message {
  id: number;
  thread_id: number;
  role: 'user' | 'assistant';
  text: string;
  status?: 'streaming' | 'shaping' | 'casting' | 'done' | 'error';
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  id: number;
  project_id: number;
  thread_id: number;
  v: number;
  kind: 'svg' | 'image' | 'html' | 'pdf';
  uri: string;
  summary: string;
  delta: string;
  created_by: string;
  embedding: number[] | null;
  tags: string | null;
  created_at: string;
}

export interface Event {
  id: number;
  project_id: number;
  thread_id: number;
  event_type: string;
  payload: any;
  created_at: string;
}

export interface ArtifactResonance {
  id: number;
  artifact_a_id: number;
  artifact_b_id: number;
  score: number;
  reason: string;
  created_at: string;
}
