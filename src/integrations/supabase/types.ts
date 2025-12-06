export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      instances: {
        Row: {
          api_key: string | null
          api_url: string | null
          id: string
          instance_name: string
          last_connected: string | null
          qr_code: string | null
          status: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          id?: string
          instance_name: string
          last_connected?: string | null
          qr_code?: string | null
          status?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          id?: string
          instance_name?: string
          last_connected?: string | null
          qr_code?: string | null
          status?: string | null
        }
        Relationships: []
      }
      jewelry_items: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          image_url: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          image_url: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_distribution: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      lead_distribution_config: {
        Row: {
          enabled: boolean | null
          id: string
          last_assigned_index: number | null
          updated_at: string | null
        }
        Insert: {
          enabled?: boolean | null
          id?: string
          last_assigned_index?: number | null
          updated_at?: string | null
        }
        Update: {
          enabled?: boolean | null
          id?: string
          last_assigned_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          kanban_position: number | null
          name: string | null
          notes: string | null
          phone: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          kanban_position?: number | null
          name?: string | null
          notes?: string | null
          phone: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          kanban_position?: number | null
          name?: string | null
          notes?: string | null
          phone?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_shortcuts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          trigger: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          trigger: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          trigger?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          direction: string
          id: string
          lead_id: string | null
          media_type: string | null
          media_url: string | null
          message_text: string | null
          phone: string
          read: boolean | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          direction: string
          id?: string
          lead_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          phone: string
          read?: boolean | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          direction?: string
          id?: string
          lead_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          phone?: string
          read?: boolean | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_dados_cliente: {
        Row: {
          created_at: string
          id: number
          nome: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      n8n_fila_mensagens: {
        Row: {
          id: number
          id_mensagem: string
          mensagem: string
          telefone: string
          timestamp: string
        }
        Insert: {
          id?: number
          id_mensagem: string
          mensagem: string
          telefone: string
          timestamp: string
        }
        Update: {
          id?: number
          id_mensagem?: string
          mensagem?: string
          telefone?: string
          timestamp?: string
        }
        Relationships: []
      }
      n8n_historico_mensagens: {
        Row: {
          created_at: string
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          created_at?: string
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_status_atendimento: {
        Row: {
          aguardando_followup: boolean
          id: number
          lock_conversa: boolean
          numero_followup: number
          session_id: string
          updated_at: string
        }
        Insert: {
          aguardando_followup?: boolean
          id?: number
          lock_conversa?: boolean
          numero_followup?: number
          session_id: string
          updated_at?: string
        }
        Update: {
          aguardando_followup?: boolean
          id?: number
          lock_conversa?: boolean
          numero_followup?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      app_profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          assigned_to: string | null
          dia_semana: number | null
          hora: number | null
          leads_ganhos: number | null
          leads_hoje: number | null
          leads_perdidos: number | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      format_brazilian_phone: { Args: { p_phone: string }; Returns: string }
      get_next_assigned_user: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      upsert_lead_from_webhook: {
        Args: { p_name?: string; p_phone: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
