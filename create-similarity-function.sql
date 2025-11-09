-- Create function to find similar artifacts using pgvector cosine similarity
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION find_similar_artifacts(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  target_thread_id bigint
)
RETURNS TABLE (
  id bigint,
  v integer,
  summary text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    artifact_versions.id,
    artifact_versions.v,
    artifact_versions.summary,
    1 - (artifact_versions.embedding <=> query_embedding) as similarity
  FROM artifact_versions
  WHERE artifact_versions.thread_id = target_thread_id
    AND artifact_versions.embedding IS NOT NULL
    AND 1 - (artifact_versions.embedding <=> query_embedding) >= match_threshold
  ORDER BY artifact_versions.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Test the function (should return empty for now)
SELECT * FROM find_similar_artifacts(
  array_fill(0, ARRAY[1536])::vector(1536),
  0.85,
  1,
  1
);
