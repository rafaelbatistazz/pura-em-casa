export type UserRole = 'admin' | 'user';
export type LeadStatus = string;
export type MessageDirection = 'inbound' | 'outbound';
export type InstanceStatus = 'connected' | 'disconnected' | 'connecting';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Lead {
  id: string;
  phone: string;
  name: string;
  assigned_to: string | null;
  status: LeadStatus;
  kanban_position: number;
  created_at: string;
  updated_at: string;
  ai_enabled?: boolean;
  followup_enabled?: boolean;
  notes?: string | null;
  source?: string | null;
  cleaning_date?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  users?: User;
}

export type MediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker' | null;

export interface Message {
  id: string;
  lead_id: string;
  phone: string;
  message_text: string;
  media_url: string | null;
  media_type: MediaType;
  direction: MessageDirection;
  sender_name: string;
  timestamp: string;
  read: boolean;
}

export interface Instance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  qr_code: string | null;
  status: InstanceStatus;
  last_connected: string | null;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface MessageShortcut {
  id: string;
  trigger: string;
  content: string;
  created_at: string;
  created_by: string | null;
}

export interface LeadDistribution {
  id: string;
  user_id: string;
  is_active: boolean;
  position: number;
  created_at: string;
  users?: User;
}

export interface LeadDistributionConfig {
  id: string;
  enabled: boolean;
  last_assigned_index: number;
  updated_at: string;
}

export interface LeadWithMessages extends Lead {
  messages?: Message[];
}

export interface Database {
  public: {
    Tables: {
      app_profiles: {
        Row: User;
        Insert: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: UserRole;
        };
      };
      leads: {
        Row: Lead;
        Insert: {
          phone: string;
          name: string;
          assigned_to?: string | null;
          status?: LeadStatus;
          kanban_position?: number;
          notes?: string | null;
          source?: string | null;
          cleaning_date?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
        };
        Update: {
          phone?: string;
          name?: string;
          assigned_to?: string | null;
          status?: LeadStatus;
          kanban_position?: number;
          updated_at?: string;
          notes?: string | null;
          source?: string | null;
          cleaning_date?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
        };
      };
      messages: {
        Row: Message;
        Insert: {
          lead_id: string;
          phone: string;
          message_text: string;
          media_url?: string | null;
          direction: MessageDirection;
          sender_name: string;
          timestamp: string;
          read: boolean;
        };
        Update: {
          lead_id?: string;
          phone?: string;
          message_text?: string;
          media_url?: string | null;
          direction?: MessageDirection;
          sender_name?: string;
          timestamp?: string;
          read?: boolean;
        };
      };
      instances: {
        Row: Instance;
        Insert: {
          instance_name: string;
          api_url: string;
          api_key: string;
          qr_code?: string | null;
          status?: InstanceStatus;
          last_connected?: string | null;
        };
        Update: {
          instance_name?: string;
          api_url?: string;
          api_key?: string;
          qr_code?: string | null;
          status?: InstanceStatus;
          last_connected?: string | null;
        };
      };
      system_config: {
        Row: SystemConfig;
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
      };
      message_shortcuts: {
        Row: MessageShortcut;
        Insert: {
          trigger: string;
          content: string;
          created_by?: string | null;
        };
        Update: {
          trigger?: string;
          content?: string;
          created_by?: string | null;
        };
      };
      kanban_columns: {
        Row: {
          id: string;
          status_id: string;
          title: string;
          color: string | null;
          position: number;
          usage_limit: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status_id: string;
          title: string;
          color?: string | null;
          position: number;
          usage_limit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status_id?: string;
          title?: string;
          color?: string | null;
          position?: number;
          usage_limit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      check_lead_status: {
        Args: { phone_number: string };
        Returns: { exists: boolean; lead_id?: string; assigned_to_name?: string };
      };
      delete_user_by_id: {
        Args: { user_id: string };
        Returns: void;
      };
    };
  };
}