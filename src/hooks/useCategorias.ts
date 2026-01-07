import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizarTexto, fuzzySearch } from '@/lib/recurrence';

export interface Categoria {
  id: string;
  nome: string;
  nome_normalizado: string;
  tipo: 'receita' | 'despesa';
  categoria_pai_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCategorias(tipo?: 'receita' | 'despesa') {
  return useQuery({
    queryKey: ['categorias', tipo],
    queryFn: async () => {
      let query = supabase
        .from('categorias')
        .select('*')
        .order('nome');
      
      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

export function useCategoriasWithSearch(tipo: 'receita' | 'despesa', searchQuery: string) {
  const { data: categorias = [], ...rest } = useCategorias(tipo);
  
  const filteredCategorias = searchQuery
    ? fuzzySearch(categorias, searchQuery)
    : categorias;

  return {
    ...rest,
    data: filteredCategorias,
    allCategorias: categorias,
  };
}

export function useCreateCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoria: { nome: string; tipo: 'receita' | 'despesa'; categoria_pai_id?: string }) => {
      const { data, error } = await supabase
        .from('categorias')
        .insert({
          nome: categoria.nome,
          nome_normalizado: normalizarTexto(categoria.nome),
          tipo: categoria.tipo,
          categoria_pai_id: categoria.categoria_pai_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Categoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}

export function useDeleteCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}
