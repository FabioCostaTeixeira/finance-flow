export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_memory: {
        Row: {
          agent: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          agent: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          agent?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      api_access_logs: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          response_status: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          response_status?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          response_status?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          ativa: boolean
          created_at: string
          hash: string
          id: string
          nome: string
          prefixo: string
          tenant_id: string
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          hash: string
          id?: string
          nome: string
          prefixo: string
          tenant_id: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          hash?: string
          id?: string
          nome?: string
          prefixo?: string
          tenant_id?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          antes: Json | null
          created_at: string
          depois: Json | null
          id: number
          operacao: string
          registro_id: string | null
          tabela: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: number
          operacao: string
          registro_id?: string | null
          tabela: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: number
          operacao?: string
          registro_id?: string | null
          tabela?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bancos: {
        Row: {
          created_at: string
          id: string
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bancos_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          categoria_pai_id: string | null
          created_at: string | null
          id: string
          nome: string
          nome_normalizado: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string | null
        }
        Insert: {
          categoria_pai_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          nome_normalizado: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
        }
        Update: {
          categoria_pai_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          nome_normalizado?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          banco: string | null
          banco_id: string | null
          categoria_id: string | null
          cliente_credor: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          frequencia: string | null
          id: string
          observacao: string | null
          parcela_atual: number | null
          recorrencia_id: string | null
          status: Database["public"]["Enums"]["status_lancamento"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          total_parcelas: number | null
          transferencia_vinculo_id: string | null
          updated_at: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          banco?: string | null
          banco_id?: string | null
          categoria_id?: string | null
          cliente_credor: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          frequencia?: string | null
          id?: string
          observacao?: string | null
          parcela_atual?: number | null
          recorrencia_id?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          total_parcelas?: number | null
          transferencia_vinculo_id?: string | null
          updated_at?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          banco?: string | null
          banco_id?: string | null
          categoria_id?: string | null
          cliente_credor?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          frequencia?: string | null
          id?: string
          observacao?: string | null
          parcela_atual?: number | null
          recorrencia_id?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          total_parcelas?: number | null
          transferencia_vinculo_id?: string | null
          updated_at?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_audit: {
        Row: {
          id: string
          lancamento_id: string | null
          operacao: string
          realizado_em: string
          usuario_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          id?: string
          lancamento_id?: string | null
          operacao: string
          realizado_em?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          id?: string
          lancamento_id?: string | null
          operacao?: string
          realizado_em?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_audit_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_audit_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_bi"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_operators: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          plano: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          plano?: string
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          plano?: string
          slug?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          module_key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          module_key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          module_key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lancamentos_bi: {
        Row: {
          banco: string | null
          categoria: string | null
          categoria_pai: string | null
          cliente_credor: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id: string | null
          observacao: string | null
          parcela_atual: number | null
          status: string | null
          tipo: string | null
          total_parcelas: number | null
          valor: number | null
          valor_pago: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access: {
        Args: { _module: string; _tenant: string }
        Returns: boolean
      }
      get_bancos_com_saldos: {
        Args: { _data_fim?: string; _data_inicio?: string; _tenant: string }
        Returns: {
          banco_id: string
          banco_nome: string
          entradas_a_receber: number
          entradas_recebidas: number
          saidas_a_pagar: number
          saidas_pagas: number
          saldo: number
          total_entradas: number
          total_saidas: number
        }[]
      }
      get_fluxo_caixa: {
        Args: { _data_fim?: string; _data_inicio?: string; _tenant: string }
        Returns: {
          entradas: number
          mes: string
          saidas: number
          saldo: number
        }[]
      }
      is_tenant_admin: { Args: { _tenant: string }; Returns: boolean }
      me: { Args: never; Returns: Json }
      modulo_do_lancamento: {
        Args: { _tipo: Database["public"]["Enums"]["tipo_lancamento"] }
        Returns: string
      }
      my_tenant_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role: "master" | "admin" | "user"
      frequencia_recorrencia: "semanal" | "mensal" | "trimestral" | "semestral"
      status_lancamento:
        | "a_receber"
        | "recebido"
        | "pago"
        | "a_pagar"
        | "parcial"
        | "atrasado"
        | "vencida"
        | "transferencia"
      tipo_lancamento: "receita" | "despesa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["master", "admin", "user"],
      frequencia_recorrencia: ["semanal", "mensal", "trimestral", "semestral"],
      status_lancamento: [
        "a_receber",
        "recebido",
        "pago",
        "a_pagar",
        "parcial",
        "atrasado",
        "vencida",
        "transferencia",
      ],
      tipo_lancamento: ["receita", "despesa"],
    },
  },
} as const

