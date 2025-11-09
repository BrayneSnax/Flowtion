-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threads table
CREATE TABLE IF NOT EXISTS threads (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  status TEXT CHECK (status IN ('streaming', 'shaping', 'casting', 'done', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifact versions table with vector embeddings
CREATE TABLE IF NOT EXISTS artifact_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  v INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('svg', 'image', 'html', 'pdf')),
  uri TEXT NOT NULL,
  summary TEXT NOT NULL,
  delta TEXT NOT NULL,
  created_by TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding dimension
  tags TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, v)
);

-- Events table for breathing cycle tracking
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifact resonance table
CREATE TABLE IF NOT EXISTS artifact_resonance (
  id BIGSERIAL PRIMARY KEY,
  artifact_a_id BIGINT NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
  artifact_b_id BIGINT NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (artifact_a_id < artifact_b_id),
  UNIQUE(artifact_a_id, artifact_b_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_project_id ON threads(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_thread_id ON artifact_versions(thread_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_project_id ON artifact_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_events_thread_id ON events(thread_id);

-- Vector similarity search index (IVFFlat for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_artifact_versions_embedding ON artifact_versions 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Row Level Security (RLS) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_resonance ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (you can tighten this later with user authentication)
CREATE POLICY "Allow all operations on projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all operations on threads" ON threads FOR ALL USING (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on artifact_versions" ON artifact_versions FOR ALL USING (true);
CREATE POLICY "Allow all operations on events" ON events FOR ALL USING (true);
CREATE POLICY "Allow all operations on artifact_resonance" ON artifact_resonance FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for messages table
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
