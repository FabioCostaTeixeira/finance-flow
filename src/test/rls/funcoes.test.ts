import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAdminClient,
  createUserClient,
  seedTenant,
  createMember,
  cleanup,
  uniqueEmail,
} from './helpers';

describe('RPCs com escopo', () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantA = (await seedTenant(admin, 'RPC A')).tenantId;
    tenantB = (await seedTenant(admin, 'RPC B')).tenantId;

    const memberA = await createMember(admin, tenantA, uniqueEmail('a'), 'master');
    const memberB = await createMember(admin, tenantB, uniqueEmail('b'), 'master');
    userIds = [memberA.userId, memberB.userId];

    const { data: bank } = await admin
      .from('bancos')
      .insert({ tenant_id: tenantA, nome: 'Banco A' })
      .select('id')
      .single();

    // Regressão de 2026-09-19: valor_pago é DEFAULT 0, mas a RPC usava
    // COALESCE(valor_pago, valor). O realizado ficava 0 em vez de 5.
    await admin.from('lancamentos').insert({
      tenant_id: tenantA,
      banco_id: bank!.id,
      tipo: 'receita',
      status: 'recebido',
      cliente_credor: 'A',
      valor: 5,
      valor_pago: 0,
      data_vencimento: '2026-09-10',
      data_pagamento: '2026-09-10',
    });

    clientA = await createUserClient(
      (await admin.auth.admin.getUserById(memberA.userId)).data.user!.email!,
      memberA.password,
    );
    clientB = await createUserClient(
      (await admin.auth.admin.getUserById(memberB.userId)).data.user!.email!,
      memberB.password,
    );
  });

  afterAll(() => cleanup(admin, userIds, [tenantA, tenantB]));

  it('calcula liquidado com valor_pago zero pelo valor do lançamento', async () => {
    const { data, error } = await clientA.rpc('get_bancos_com_saldos', { _tenant: tenantA });
    expect(error).toBeNull();
    const banco = data?.find((row: { banco_nome: string }) => row.banco_nome === 'Banco A');
    expect(Number(banco?.entradas_recebidas)).toBe(5);
    expect(Number(banco?.saldo_atual_real)).toBe(5);
  });

  it('RPC recusa tenant alheio', async () => {
    const { data, error } = await clientB.rpc('get_bancos_com_saldos', { _tenant: tenantA });
    expect(data).toBeNull();
    expect(error?.message).toContain('Acesso negado');
  });

  it('fluxo alheio recusa', async () => {
    const { error } = await clientB.rpc('get_fluxo_caixa', { _tenant: tenantA });
    expect(error?.message).toContain('Acesso negado');
  });

  it('query privilegiada não é exposta', async () => {
    expect((await clientA.rpc('execute_readonly_query', { query_text: 'SELECT 1' })).error).not.toBeNull();
  });
});
