import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizarTexto } from '@/lib/recurrence';

export interface UpdateCategoriaInput {
  id: string;
  nome: string;
}

export function useUpdateCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCategoriaInput) => {
      const { data, error } = await supabase
        .from('categorias')
        .update({
          nome: input.nome,
          nome_normalizado: normalizarTexto(input.nome),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}
