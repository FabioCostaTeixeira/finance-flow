import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export type AIProvider = 'lovable' | 'openai' | 'anthropic' | 'google' | 'groq';

export interface AISettings {
  id: number;
  provider: AIProvider;
  model: string;
  api_key: string | null;
  system_prompt_override: string | null;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export const PROVIDER_MODELS: Record<AIProvider, { label: string; models: { value: string; label: string }[] }> = {
  lovable: {
    label: 'Lovable AI (padrão, sem chave)',
    models: [
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido, padrão)' },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (raciocínio)' },
      { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (econômico)' },
      { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
      { value: 'openai/gpt-5', label: 'GPT-5 (OpenAI via Lovable)' },
      { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (OpenAI via Lovable)' },
    ],
  },
  openai: {
    label: 'OpenAI (sua API key)',
    models: [
      { value: 'gpt-4.1', label: 'GPT-4.1 (recomendado)' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (econômico)' },
      { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (mais leve)' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'o3', label: 'o3 (raciocínio avançado)' },
      { value: 'o4-mini', label: 'o4-mini (raciocínio rápido)' },
    ],
  },
  anthropic: {
    label: 'Anthropic Claude (sua API key)',
    models: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
  google: {
    label: 'Google Gemini direto (sua API key)',
    models: [
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (recomendado)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (estável)' },
    ],
  },
  groq: {
    label: 'Groq (sua API key)',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (rápido)' },
      { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
  },
};

export function useAISettings() {
  const { activeTenant } = useTenant();
  return useQuery({
    queryKey: ['ai-settings', activeTenant?.id], enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_settings').select('*').eq('tenant_id', activeTenant!.id).maybeSingle();
      if (error) throw error;
      return data as AISettings | null;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateAISettings() {
  const qc = useQueryClient();
  const { activeTenant } = useTenant();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AISettings, 'id' | 'updated_at' | 'updated_by'>>) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('ai_settings')
        .upsert(
          { ...patch, tenant_id: activeTenant.id, updated_by: user?.id ?? null },
          { onConflict: 'tenant_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  });
}
