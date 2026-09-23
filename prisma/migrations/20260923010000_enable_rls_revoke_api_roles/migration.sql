-- Harden Supabase public schema for Prisma-only access.
-- Visamile talks to Postgres via DATABASE_URL (Prisma) and Storage via
-- SUPABASE_SERVICE_ROLE_KEY. PostgREST roles anon/authenticated must not
-- read or write application tables.

-- Enable RLS on all public tables (no policies => deny for non-bypass roles)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
  END LOOP;
END $$;

-- Revoke API-role privileges on tables/views
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', r.t);
  END LOOP;
END $$;

-- Revoke on sequences
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated, PUBLIC', r.t);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
