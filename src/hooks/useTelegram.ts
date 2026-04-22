import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MessagingChannel {
  id: string;
  user_id: string;
  channel_type: 'telegram' | 'whatsapp';
  channel_user_id: string | null;
  display_name: string | null;
  pairing_token: string | null;
  pairing_expires_at: string | null;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
  updated_at: string;
}

export function useMyChannels() {
  return useQuery({
    queryKey: ['my-messaging-channels'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('messaging_channels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MessagingChannel[];
    },
  });
}

export function useGenerateTelegramPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('telegram-pair');
      if (error) throw error;
      return data as { token: string; expires_at: string; id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-messaging-channels'] }),
  });
}

export function useRevokeChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('messaging_channels')
        .update({ status: 'revoked' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-messaging-channels'] }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('messaging_channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-messaging-channels'] }),
  });
}