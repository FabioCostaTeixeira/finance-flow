-- Preenche tenant_id automaticamente quando o usuário pertence a exatamente um
-- tenant. Com mais de um, exige o valor explícito — adivinhar seria pior que falhar.

CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidatos uuid[];
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(t) INTO candidatos FROM public.my_tenant_ids() AS t;

  IF candidatos IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  ELSIF array_length(candidatos, 1) > 1 THEN
    RAISE EXCEPTION 'Usuário pertence a % tenants; tenant_id é obrigatório',
      array_length(candidatos, 1);
  END IF;

  NEW.tenant_id := candidatos[1];
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_tenant_id() FROM anon, public;

DROP TRIGGER IF EXISTS trg_set_tenant_id_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_set_tenant_id_lancamentos
  BEFORE INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_bancos ON public.bancos;
CREATE TRIGGER trg_set_tenant_id_bancos
  BEFORE INSERT ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_categorias ON public.categorias;
CREATE TRIGGER trg_set_tenant_id_categorias
  BEFORE INSERT ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_chat_messages ON public.chat_messages;
CREATE TRIGGER trg_set_tenant_id_chat_messages
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_messaging_channels ON public.messaging_channels;
CREATE TRIGGER trg_set_tenant_id_messaging_channels
  BEFORE INSERT ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Impede troca de tenant em UPDATE: mover uma linha de tenant é sempre bug ou ataque.
-- Isso também bloqueia service_role e postgres — desenho intencional. Um backfill
-- legítimo futuro que precise reatribuir tenant_id em massa deve usar
-- `ALTER TABLE ... DISABLE TRIGGER trg_freeze_tenant_id_<tabela>` (e reabilitar depois).
CREATE OR REPLACE FUNCTION public.freeze_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id não pode ser alterado';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.freeze_tenant_id() FROM anon, public;

DROP TRIGGER IF EXISTS trg_freeze_tenant_id_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_freeze_tenant_id_lancamentos
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

DROP TRIGGER IF EXISTS trg_freeze_tenant_id_bancos ON public.bancos;
CREATE TRIGGER trg_freeze_tenant_id_bancos
  BEFORE UPDATE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

DROP TRIGGER IF EXISTS trg_freeze_tenant_id_categorias ON public.categorias;
CREATE TRIGGER trg_freeze_tenant_id_categorias
  BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

DROP TRIGGER IF EXISTS trg_freeze_tenant_id_chat_messages ON public.chat_messages;
CREATE TRIGGER trg_freeze_tenant_id_chat_messages
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

DROP TRIGGER IF EXISTS trg_freeze_tenant_id_messaging_channels ON public.messaging_channels;
CREATE TRIGGER trg_freeze_tenant_id_messaging_channels
  BEFORE UPDATE ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();
