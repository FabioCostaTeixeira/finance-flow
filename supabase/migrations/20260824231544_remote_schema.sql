


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'master',
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."frequencia_recorrencia" AS ENUM (
    'semanal',
    'mensal',
    'trimestral',
    'semestral'
);


ALTER TYPE "public"."frequencia_recorrencia" OWNER TO "postgres";


CREATE TYPE "public"."status_lancamento" AS ENUM (
    'a_receber',
    'recebido',
    'pago',
    'a_pagar',
    'parcial',
    'atrasado',
    'vencida',
    'transferencia'
);


ALTER TYPE "public"."status_lancamento" OWNER TO "postgres";


CREATE TYPE "public"."tipo_lancamento" AS ENUM (
    'receita',
    'despesa'
);


ALTER TYPE "public"."tipo_lancamento" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_lancamentos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_novo, usuario_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_anterior, valor_novo, usuario_id)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    -- lancamento_id = NULL porque o registro já não existe mais;
    -- o snapshot completo fica preservado em valor_anterior
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_anterior, usuario_id)
    VALUES (NULL, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_lancamentos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_readonly_query"("query_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  normalized := regexp_replace(normalized, E'--[^\\n]*', '', 'g');
  normalized := regexp_replace(normalized, '/\\*.*?\\*/', '', 'g');
  normalized := trim(normalized);

  IF NOT (normalized LIKE 'select %' OR normalized LIKE 'with %' OR normalized = 'select') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  FOREACH forbidden_word IN ARRAY forbidden
  LOOP
    IF normalized ~ (E'\\m' || forbidden_word) THEN
      RAISE EXCEPTION 'Forbidden command or reference: %', forbidden_word;
    END IF;
  END LOOP;

  IF position(';' in trim(trailing ';' from normalized)) > 0 THEN
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- Removed SET LOCAL ROLE finance_readonly which is incompatible with SECURITY DEFINER
  -- The function already validates input through the forbidden words list above

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s LIMIT 200) t',
    trim(trailing ';' from query_text)
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution error: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."execute_readonly_query"("query_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bancos_com_saldos"("data_inicio" "date" DEFAULT NULL::"date", "data_fim" "date" DEFAULT NULL::"date") RETURNS TABLE("banco_id" "uuid", "banco_nome" "text", "total_entradas" numeric, "total_saidas" numeric, "saldo" numeric, "entradas_recebidas" numeric, "entradas_a_receber" numeric, "saidas_pagas" numeric, "saidas_a_pagar" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id::uuid                AS banco_id,
    b.nome::text              AS banco_nome,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0)::numeric AS total_entradas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0)::numeric AS total_saidas,
    (COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0))::numeric AS saldo,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND l.status IN ('recebido', 'parcial', 'transferencia')
      AND (data_inicio IS NULL OR l.data_pagamento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_pagamento <= data_fim)
      THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0)::numeric AS entradas_recebidas,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND l.status IN ('a_receber', 'atrasado', 'vencida')
      AND (data_inicio IS NULL OR l.data_vencimento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_vencimento <= data_fim)
      THEN l.valor ELSE 0 END), 0)::numeric AS entradas_a_receber,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND l.status IN ('pago', 'parcial', 'transferencia')
      AND (data_inicio IS NULL OR l.data_pagamento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_pagamento <= data_fim)
      THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0)::numeric AS saidas_pagas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND l.status IN ('a_pagar', 'atrasado')
      AND (data_inicio IS NULL OR l.data_vencimento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_vencimento <= data_fim)
      THEN l.valor ELSE 0 END), 0)::numeric AS saidas_a_pagar
  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id
  GROUP BY b.id, b.nome
  ORDER BY b.nome;
END;
$$;


ALTER FUNCTION "public"."get_bancos_com_saldos"("data_inicio" "date", "data_fim" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("_user_id" "uuid", "_module_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Master always has access
  SELECT CASE
    WHEN public.has_role(_user_id, 'master') THEN true
    ELSE COALESCE(
      (SELECT allowed FROM public.user_permissions WHERE user_id = _user_id AND module_key = _module_key),
      false
    )
  END
$$;


ALTER FUNCTION "public"."has_permission"("_user_id" "uuid", "_module_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_chat_message_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_chat_message_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_settings" (
    "id" integer NOT NULL,
    "provider" "text" DEFAULT 'lovable'::"text" NOT NULL,
    "model" "text" DEFAULT 'google/gemini-2.5-flash'::"text" NOT NULL,
    "api_key" "text",
    "system_prompt_override" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "ai_settings_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."ai_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "response_status" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."api_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "chave" "text" NOT NULL,
    "ativa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultimo_acesso" timestamp with time zone
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bancos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bancos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "nome_normalizado" "text" NOT NULL,
    "categoria_pai_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo" "public"."tipo_lancamento" DEFAULT 'despesa'::"public"."tipo_lancamento" NOT NULL
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "cliente_credor" "text" NOT NULL,
    "valor" numeric(15,2) NOT NULL,
    "valor_pago" numeric(15,2) DEFAULT 0,
    "banco" "text",
    "categoria_id" "uuid",
    "recorrencia_id" "uuid",
    "parcela_atual" integer DEFAULT 1,
    "total_parcelas" integer DEFAULT 1,
    "observacao" "text",
    "data_pagamento" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "banco_id" "uuid",
    "transferencia_vinculo_id" "uuid",
    "frequencia" "text",
    "status" "public"."status_lancamento" DEFAULT 'a_receber'::"public"."status_lancamento" NOT NULL,
    "tipo" "public"."tipo_lancamento" DEFAULT 'receita'::"public"."tipo_lancamento" NOT NULL
);


ALTER TABLE "public"."lancamentos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lancamentos"."transferencia_vinculo_id" IS 'UUID compartilhado entre os dois lançamentos de uma transferência (origem e destino)';



CREATE TABLE IF NOT EXISTS "public"."lancamentos_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lancamento_id" "uuid",
    "operacao" "text" NOT NULL,
    "valor_anterior" "jsonb",
    "valor_novo" "jsonb",
    "usuario_id" "uuid",
    "realizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lancamentos_audit_operacao_check" CHECK (("operacao" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."lancamentos_audit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."lancamentos_bi" WITH ("security_invoker"='true') AS
 SELECT "l"."id",
    "l"."data_vencimento",
    "l"."cliente_credor",
    ("l"."valor")::double precision AS "valor",
    ("l"."valor_pago")::double precision AS "valor_pago",
    "l"."banco",
    ("l"."status")::"text" AS "status",
    ("l"."tipo")::"text" AS "tipo",
    "c"."nome" AS "categoria",
    "cp"."nome" AS "categoria_pai",
    "l"."parcela_atual",
    "l"."total_parcelas",
    "l"."observacao",
    "l"."data_pagamento",
    "l"."created_at"
   FROM (("public"."lancamentos" "l"
     LEFT JOIN "public"."categorias" "c" ON (("l"."categoria_id" = "c"."id")))
     LEFT JOIN "public"."categorias" "cp" ON (("c"."categoria_pai_id" = "cp"."id")));


ALTER VIEW "public"."lancamentos_bi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messaging_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel_type" "text" NOT NULL,
    "channel_user_id" "text",
    "display_name" "text",
    "pairing_token" "text",
    "pairing_expires_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messaging_channels_channel_type_check" CHECK (("channel_type" = ANY (ARRAY['telegram'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "messaging_channels_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."messaging_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_bot_state" (
    "id" integer NOT NULL,
    "update_offset" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "telegram_bot_state_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."telegram_bot_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_messages" (
    "update_id" bigint NOT NULL,
    "chat_id" bigint NOT NULL,
    "text" "text",
    "raw_update" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processed_at" timestamp with time zone,
    "response_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."telegram_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "allowed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_agent_key_key" UNIQUE ("agent", "key");



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_access_logs"
    ADD CONSTRAINT "api_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bancos"
    ADD CONSTRAINT "bancos_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."bancos"
    ADD CONSTRAINT "bancos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lancamentos_audit"
    ADD CONSTRAINT "lancamentos_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_channel_type_channel_user_id_key" UNIQUE ("channel_type", "channel_user_id");



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."telegram_bot_state"
    ADD CONSTRAINT "telegram_bot_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_messages"
    ADD CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("update_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_module_key_key" UNIQUE ("user_id", "module_key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_api_access_logs_api_key_id" ON "public"."api_access_logs" USING "btree" ("api_key_id");



CREATE INDEX "idx_api_access_logs_created_at" ON "public"."api_access_logs" USING "btree" ("created_at");



CREATE INDEX "idx_api_keys_chave" ON "public"."api_keys" USING "btree" ("chave");



CREATE INDEX "idx_categorias_nome_normalizado" ON "public"."categorias" USING "btree" ("nome_normalizado");



CREATE INDEX "idx_categorias_tipo" ON "public"."categorias" USING "btree" ("tipo");



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_lancamentos_data_vencimento" ON "public"."lancamentos" USING "btree" ("data_vencimento");



CREATE INDEX "idx_lancamentos_recorrencia_id" ON "public"."lancamentos" USING "btree" ("recorrencia_id");



CREATE INDEX "idx_lancamentos_status" ON "public"."lancamentos" USING "btree" ("status");



CREATE INDEX "idx_lancamentos_tipo" ON "public"."lancamentos" USING "btree" ("tipo");



CREATE INDEX "idx_messaging_channels_pairing" ON "public"."messaging_channels" USING "btree" ("pairing_token") WHERE ("pairing_token" IS NOT NULL);



CREATE INDEX "idx_messaging_channels_user" ON "public"."messaging_channels" USING "btree" ("user_id");



CREATE INDEX "idx_telegram_messages_chat" ON "public"."telegram_messages" USING "btree" ("chat_id");



CREATE INDEX "idx_telegram_messages_processed" ON "public"."telegram_messages" USING "btree" ("processed") WHERE ("processed" = false);



CREATE OR REPLACE TRIGGER "ai_settings_updated_at" BEFORE UPDATE ON "public"."ai_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "lancamentos_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_lancamentos"();



CREATE OR REPLACE TRIGGER "messaging_channels_updated_at" BEFORE UPDATE ON "public"."messaging_channels" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_set_chat_message_user_id" BEFORE INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_chat_message_user_id"();



CREATE OR REPLACE TRIGGER "update_api_keys_updated_at" BEFORE UPDATE ON "public"."api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bancos_updated_at" BEFORE UPDATE ON "public"."bancos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categorias_updated_at" BEFORE UPDATE ON "public"."categorias" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lancamentos_updated_at" BEFORE UPDATE ON "public"."lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."api_access_logs"
    ADD CONSTRAINT "api_access_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_categoria_pai_id_fkey" FOREIGN KEY ("categoria_pai_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lancamentos_audit"
    ADD CONSTRAINT "lancamentos_audit_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lancamentos_audit"
    ADD CONSTRAINT "lancamentos_audit_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_banco_id_fkey" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated can delete bancos" ON "public"."bancos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can delete categorias" ON "public"."categorias" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can delete chat_messages" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can delete lancamentos" ON "public"."lancamentos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can insert bancos" ON "public"."bancos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can insert categorias" ON "public"."categorias" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can insert chat_messages" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can insert lancamentos" ON "public"."lancamentos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can update bancos" ON "public"."bancos" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can update categorias" ON "public"."categorias" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can update lancamentos" ON "public"."lancamentos" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view bancos" ON "public"."bancos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view categorias" ON "public"."categorias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view chat_messages" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view lancamentos" ON "public"."lancamentos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Master can delete api_keys" ON "public"."api_keys" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can insert api_keys" ON "public"."api_keys" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can manage all permissions" ON "public"."user_permissions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can update ai settings" ON "public"."ai_settings" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can update api_keys" ON "public"."api_keys" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can view ai settings" ON "public"."ai_settings" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can view api_access_logs" ON "public"."api_access_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master can view api_keys" ON "public"."api_keys" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Master views telegram messages" ON "public"."telegram_messages" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Only master can delete profiles" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Only master can delete roles" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Only master can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Only master can insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Only master can update roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'master'::"public"."app_role"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own permissions" ON "public"."user_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'master'::"public"."app_role")));



CREATE POLICY "Users can view their own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'master'::"public"."app_role")));



CREATE POLICY "Users delete own channels" ON "public"."messaging_channels" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'master'::"public"."app_role")));



CREATE POLICY "Users insert own channels" ON "public"."messaging_channels" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own messages" ON "public"."chat_messages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own channels" ON "public"."messaging_channels" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'master'::"public"."app_role")));



CREATE POLICY "Users view own channels" ON "public"."messaging_channels" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'master'::"public"."app_role")));



ALTER TABLE "public"."agent_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_read" ON "public"."lancamentos_audit" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."bancos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messaging_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_full" ON "public"."lancamentos_audit" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_only" ON "public"."agent_memory" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."telegram_bot_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."audit_lancamentos"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_lancamentos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_lancamentos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."execute_readonly_query"("query_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."execute_readonly_query"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bancos_com_saldos"("data_inicio" "date", "data_fim" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_bancos_com_saldos"("data_inicio" "date", "data_fim" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bancos_com_saldos"("data_inicio" "date", "data_fim" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("_user_id" "uuid", "_module_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("_user_id" "uuid", "_module_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("_user_id" "uuid", "_module_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_chat_message_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_chat_message_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_chat_message_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."agent_memory" TO "anon";
GRANT ALL ON TABLE "public"."agent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memory" TO "service_role";



GRANT ALL ON TABLE "public"."ai_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_settings" TO "service_role";



GRANT ALL ON TABLE "public"."api_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."bancos" TO "anon";
GRANT ALL ON TABLE "public"."bancos" TO "authenticated";
GRANT ALL ON TABLE "public"."bancos" TO "service_role";
GRANT SELECT ON TABLE "public"."bancos" TO "finance_readonly";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";
GRANT SELECT ON TABLE "public"."categorias" TO "finance_readonly";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos" TO "service_role";
GRANT SELECT ON TABLE "public"."lancamentos" TO "finance_readonly";



GRANT ALL ON TABLE "public"."lancamentos_audit" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_audit" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_bi" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_bi" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_bi" TO "service_role";



GRANT ALL ON TABLE "public"."messaging_channels" TO "anon";
GRANT ALL ON TABLE "public"."messaging_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."messaging_channels" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_bot_state" TO "anon";
GRANT ALL ON TABLE "public"."telegram_bot_state" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_bot_state" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_messages" TO "anon";
GRANT ALL ON TABLE "public"."telegram_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_messages" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































