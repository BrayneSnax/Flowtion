-- Add parent_id to artifact_versions for lineage tracking
-- Run this in your Supabase SQL Editor

ALTER TABLE artifact_versions 
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES artifact_versions(id) ON DELETE SET NULL;

-- Add index for lineage queries
CREATE INDEX IF NOT EXISTS idx_artifact_versions_parent_id ON artifact_versions(parent_id);

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'artifact_versions' 
  AND column_name = 'parent_id';
