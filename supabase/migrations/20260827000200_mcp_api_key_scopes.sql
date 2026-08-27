-- Migration: 20260827000200_mcp_api_key_scopes.sql
-- Description: API Key scopes, revocation, expiration and atomic rate limiting RPC

ALTER TABLE public.api_keys 
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{finance:read,finance:write}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Atomic rate limit counter table (per minute window)
CREATE TABLE IF NOT EXISTS public.api_key_rate_limits (
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_minute timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (api_key_id, window_minute)
);

ALTER TABLE public.api_key_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic rate limit increment RPC
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _api_key_id uuid,
  _max_per_minute integer DEFAULT 100
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _current_window timestamptz;
  _current_count integer;
BEGIN
  _current_window := date_trunc('minute', now());

  INSERT INTO public.api_key_rate_limits (api_key_id, window_minute, request_count)
  VALUES (_api_key_id, _current_window, 1)
  ON CONFLICT (api_key_id, window_minute)
  DO UPDATE SET request_count = public.api_key_rate_limits.request_count + 1
  RETURNING request_count INTO _current_count;

  RETURN _current_count <= _max_per_minute;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit TO service_role;
