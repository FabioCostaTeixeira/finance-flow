-- 1. Add user_id to chat_messages for per-user scoping
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Trigger to auto-populate user_id from the authenticated session
CREATE OR REPLACE FUNCTION public.set_chat_message_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_chat_message_user_id ON public.chat_messages;
CREATE TRIGGER trg_set_chat_message_user_id
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_chat_message_user_id();

-- Update RLS on chat_messages to scope by user
DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON public.chat_messages;

CREATE POLICY "Users manage own messages"
  ON public.chat_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Create finance_readonly role with SELECT-only access on financial tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'finance_readonly') THEN
    CREATE ROLE finance_readonly NOLOGIN;
  END IF;
END $$;

GRANT SELECT ON public.lancamentos TO finance_readonly;
GRANT SELECT ON public.bancos TO finance_readonly;
GRANT SELECT ON public.categorias TO finance_readonly;

-- Grant membership so the function owner can SET ROLE to finance_readonly
GRANT finance_readonly TO postgres;

-- 3. Update execute_readonly_query to run under finance_readonly role
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  normalized text;
  forbidden text[] := ARRAY[
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', 'comment', 'vacuum', 'analyze', 'reindex',
    'cluster', 'lock', 'copy', 'do ', 'call ', 'execute', 'merge',
    'auth.', 'pg_catalog', 'information_schema.role', 'pg_user',
    'pg_authid', 'pg_shadow', 'secrets', 'vault.', 'storage.',
    'supabase_functions.', 'realtime.'
  ];
  forbidden_word text;
BEGIN
  normalized := lower(trim(query_text));
  normalized := regexp_replace(normalized, '--[^\n]*', '', 'g');
  normalized := regexp_replace(normalized, '/\*.*?\*/', '', 'g');
  normalized := trim(normalized);

  IF NOT (normalized LIKE 'select %' OR normalized LIKE 'with %' OR normalized = 'select') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;

  FOREACH forbidden_word IN ARRAY forbidden
  LOOP
    IF normalized ~ ('\m' || forbidden_word) THEN
      RAISE EXCEPTION 'Comando ou referência não permitida: %', forbidden_word;
    END IF;
  END LOOP;

  IF position(';' in trim(trailing ';' from normalized)) > 0 THEN
    RAISE EXCEPTION 'Múltiplos comandos não são permitidos';
  END IF;

  -- Switch to least-privilege role for query execution
  SET LOCAL ROLE finance_readonly;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s LIMIT 200) t',
    trim(trailing ';' from query_text)
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao executar query: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;
