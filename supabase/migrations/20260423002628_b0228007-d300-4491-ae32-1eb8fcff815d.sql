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
  -- Normaliza para lowercase para validação
  normalized := lower(trim(query_text));
  
  -- Remove comentários SQL (-- e /* */)
  normalized := regexp_replace(normalized, '--[^\n]*', '', 'g');
  normalized := regexp_replace(normalized, '/\*.*?\*/', '', 'g');
  normalized := trim(normalized);
  
  -- Deve começar com SELECT ou WITH (CTE)
  IF NOT (normalized LIKE 'select %' OR normalized LIKE 'with %' OR normalized = 'select') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;
  
  -- Bloqueia palavras-chave perigosas
  FOREACH forbidden_word IN ARRAY forbidden
  LOOP
    IF normalized ~ ('\m' || forbidden_word) THEN
      RAISE EXCEPTION 'Comando ou referência não permitida: %', forbidden_word;
    END IF;
  END LOOP;
  
  -- Bloqueia múltiplos statements (;)
  IF position(';' in trim(trailing ';' from normalized)) > 0 THEN
    RAISE EXCEPTION 'Múltiplos comandos não são permitidos';
  END IF;
  
  -- Executa a query envolvendo em LIMIT 200 e convertendo pra JSON
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

-- Apenas service_role pode chamar (chamada via edge function)
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;