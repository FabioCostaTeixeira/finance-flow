import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AIProvider = 'lovable' | 'openai' | 'anthropic' | 'google';

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
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
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
      { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (experimental)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
  },
};

export function useAISettings() {
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as AISettings | null;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateAISettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AISettings, 'id' | 'updated_at' | 'updated_by'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('ai_settings')
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  });
}