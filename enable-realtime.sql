-- Enable real-time replication for Flowtion tables
-- Run this in your Supabase SQL Editor

-- Enable replication for artifact_versions table
ALTER PUBLICATION supabase_realtime ADD TABLE artifact_versions;

-- Enable replication for messages table (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify the tables are added to the publication
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
