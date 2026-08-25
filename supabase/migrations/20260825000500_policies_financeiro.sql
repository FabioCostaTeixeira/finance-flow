-- Substitui as policies USING(true) por isolamento de tenant + checagem de módulo.

DROP POLICY IF EXISTS "Authenticated can view lancamentos"   ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can insert lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can update lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can delete lancamentos" ON public.lancamentos;

DROP POLICY IF EXISTS "Authenticated can view bancos"   ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can insert bancos" ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can update bancos" ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can delete bancos" ON public.bancos;

DROP POLICY IF EXISTS "Authenticated can view categorias"   ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can insert categorias" ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can update categorias" ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can delete categorias" ON public.categorias;

-- lancamentos: o módulo exigido depende do tipo da própria linha.
-- Transferências tocam os dois lados e exigem ambos os módulos.
CREATE OR REPLACE FUNCTION public.modulo_do_lancamento(_tipo public.tipo_lancamento)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT CASE WHEN _tipo = 'receita' THEN 'receitas' ELSE 'despesas' END $$;

REVOKE EXECUTE ON FUNCTION public.modulo_do_lancamento(public.tipo_lancamento) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.modulo_do_lancamento(public.tipo_lancamento) TO authenticated;

-- Leitura ampliada: fluxo-caixa e bancos são módulos financeiros amplos que
-- também precisam ler lancamentos (tela de fluxo de caixa e saldos calculados
-- de bancos), mesmo sem acesso a receitas/despesas. Escrita continua exigindo
-- o módulo do tipo da própria linha (abaixo).
DROP POLICY IF EXISTS lancamentos_select ON public.lancamentos;
CREATE POLICY lancamentos_select ON public.lancamentos FOR SELECT TO authenticated
  USING (
    public.can_access(tenant_id, public.modulo_do_lancamento(tipo))
    OR public.can_access(tenant_id, 'fluxo-caixa')
    OR public.can_access(tenant_id, 'bancos')
  );

DROP POLICY IF EXISTS lancamentos_insert ON public.lancamentos;
CREATE POLICY lancamentos_insert ON public.lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access(tenant_id, public.modulo_do_lancamento(tipo))
    AND (status <> 'transferencia' OR (
      public.can_access(tenant_id, 'receitas') AND public.can_access(tenant_id, 'despesas')
    ))
  );

DROP POLICY IF EXISTS lancamentos_update ON public.lancamentos;
CREATE POLICY lancamentos_update ON public.lancamentos FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, public.modulo_do_lancamento(tipo)))
  WITH CHECK (
    public.can_access(tenant_id, public.modulo_do_lancamento(tipo))
    AND (status <> 'transferencia' OR (
      public.can_access(tenant_id, 'receitas') AND public.can_access(tenant_id, 'despesas')
    ))
  );

DROP POLICY IF EXISTS lancamentos_delete ON public.lancamentos;
CREATE POLICY lancamentos_delete ON public.lancamentos FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, public.modulo_do_lancamento(tipo)));

-- bancos: leitura liberada a quem acessa qualquer módulo financeiro, porque
-- combos de banco aparecem nos formulários de receita e despesa. Escrita exige
-- o módulo próprio.
DROP POLICY IF EXISTS bancos_select ON public.bancos;
CREATE POLICY bancos_select ON public.bancos FOR SELECT TO authenticated
  USING (
    public.can_access(tenant_id, 'bancos')
    OR public.can_access(tenant_id, 'receitas')
    OR public.can_access(tenant_id, 'despesas')
    OR public.can_access(tenant_id, 'fluxo-caixa')
  );

DROP POLICY IF EXISTS bancos_insert ON public.bancos;
CREATE POLICY bancos_insert ON public.bancos FOR INSERT TO authenticated
  WITH CHECK (public.can_access(tenant_id, 'bancos'));

DROP POLICY IF EXISTS bancos_update ON public.bancos;
CREATE POLICY bancos_update ON public.bancos FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, 'bancos'))
  WITH CHECK (public.can_access(tenant_id, 'bancos'));

DROP POLICY IF EXISTS bancos_delete ON public.bancos;
CREATE POLICY bancos_delete ON public.bancos FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, 'bancos'));

-- categorias: mesma lógica de leitura ampla, pelo mesmo motivo.
DROP POLICY IF EXISTS categorias_select ON public.categorias;
CREATE POLICY categorias_select ON public.categorias FOR SELECT TO authenticated
  USING (
    public.can_access(tenant_id, 'categorias')
    OR public.can_access(tenant_id, 'receitas')
    OR public.can_access(tenant_id, 'despesas')
    OR public.can_access(tenant_id, 'fluxo-caixa')
  );

DROP POLICY IF EXISTS categorias_insert ON public.categorias;
CREATE POLICY categorias_insert ON public.categorias FOR INSERT TO authenticated
  WITH CHECK (public.can_access(tenant_id, 'categorias'));

DROP POLICY IF EXISTS categorias_update ON public.categorias;
CREATE POLICY categorias_update ON public.categorias FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, 'categorias'))
  WITH CHECK (public.can_access(tenant_id, 'categorias'));

DROP POLICY IF EXISTS categorias_delete ON public.categorias;
CREATE POLICY categorias_delete ON public.categorias FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, 'categorias'));
