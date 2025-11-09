-- Fix Supabase warnings
-- Run this in your Supabase SQL Editor

-- 1. Move vector extension to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- 2. Fix search_path on trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Verify the fixes
SELECT 
  e.extname,
  n.nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'vector';

SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as config
FROM pg_proc p
WHERE p.proname = 'update_updated_at_column';
