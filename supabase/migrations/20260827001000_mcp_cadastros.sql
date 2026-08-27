-- Master data administrative operations (bancos & categorias)

ALTER TABLE public.bancos ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado'));
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado'));

CREATE OR REPLACE FUNCTION public.mover_categoria_sem_ciclo(
  p_categoria_id uuid,
  p_nova_categoria_pai_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_curr uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_NOT_SET'; END IF;

  IF p_categoria_id = p_nova_categoria_pai_id THEN
    RAISE EXCEPTION 'CATEGORIA_PAI_INVALIDA: ciclo direto';
  END IF;

  v_curr := p_nova_categoria_pai_id;
  WHILE v_curr IS NOT NULL LOOP
    SELECT categoria_pai_id INTO v_curr
    FROM public.categorias
    WHERE id = v_curr AND tenant_id = v_tenant_id;

    IF v_curr = p_categoria_id THEN
      RAISE EXCEPTION 'CICLO_DETECTADO: a categoria pai informada descende da categoria atual';
    END IF;
  END LOOP;

  UPDATE public.categorias
  SET categoria_pai_id = p_nova_categoria_pai_id, version = version + 1, updated_at = now()
  WHERE id = p_categoria_id AND tenant_id = v_tenant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mover_categoria_sem_ciclo(uuid, uuid) FROM anon, public;
