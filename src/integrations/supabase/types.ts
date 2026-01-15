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
      bets: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          id: string
          outcome_id: string | null
          payout_amount: number | null
          payout_tx_hash: string | null
          platform_fee: number | null
          position: Database["public"]["Enums"]["bet_position"]
          prediction_id: string
          status: Database["public"]["Enums"]["bet_status"]
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          outcome_id?: string | null
          payout_amount?: number | null
          payout_tx_hash?: string | null
          platform_fee?: number | null
          position: Database["public"]["Enums"]["bet_position"]
          prediction_id: string
          status?: Database["public"]["Enums"]["bet_status"]
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          outcome_id?: string | null
          payout_amount?: number | null
          payout_tx_hash?: string | null
          platform_fee?: number | null
          position?: Database["public"]["Enums"]["bet_position"]
          prediction_id?: string
          status?: Database["public"]["Enums"]["bet_status"]
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          prediction_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          prediction_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          prediction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          created_at: string
          id: string
          label: string
          pool: number
          prediction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          pool?: number
          prediction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          pool?: number
          prediction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          amount: number
          bet_id: string | null
          created_at: string
          id: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          bet_id?: string | null
          created_at?: string
          id?: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          bet_id?: string | null
          created_at?: string
          id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          category: string
          created_at: string
          creator_id: string | null
          description: string | null
          end_date: string
          escrow_address: string
          id: string
          image_url: string | null
          no_pool: number
          resolution_date: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["prediction_status"]
          title: string
          updated_at: string
          yes_pool: number
        }
        Insert: {
          category?: string
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date: string
          escrow_address: string
          id?: string
          image_url?: string | null
          no_pool?: number
          resolution_date?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["prediction_status"]
          title: string
          updated_at?: string
          yes_pool?: number
        }
        Update: {
          category?: string
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date?: string
          escrow_address?: string
          id?: string
          image_url?: string | null
          no_pool?: number
          resolution_date?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["prediction_status"]
          title?: string
          updated_at?: string
          yes_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          total_bets: number | null
          total_volume: number | null
          total_wins: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          total_bets?: number | null
          total_volume?: number | null
          total_wins?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          total_bets?: number | null
          total_volume?: number | null
          total_wins?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_topics: {
        Row: {
          created_at: string
          creation_fee_tx: string | null
          creator_address_hash: string
          description: string | null
          expires_at: string
          id: string
          status: string
          title: string
          vote_cost: number
        }
        Insert: {
          created_at?: string
          creation_fee_tx?: string | null
          creator_address_hash: string
          description?: string | null
          expires_at?: string
          id?: string
          status?: string
          title: string
          vote_cost?: number
        }
        Update: {
          created_at?: string
          creation_fee_tx?: string | null
          creator_address_hash?: string
          description?: string | null
          expires_at?: string
          id?: string
          status?: string
          title?: string
          vote_cost?: number
        }
        Relationships: []
      }
      sentiment_votes: {
        Row: {
          created_at: string
          id: string
          position: string
          topic_id: string
          tx_hash: string | null
          voter_address_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: string
          topic_id: string
          tx_hash?: string | null
          voter_address_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: string
          topic_id?: string
          tx_hash?: string | null
          voter_address_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_votes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "sentiment_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          ecash_address: string
          id: string
          last_login_at: string | null
        }
        Insert: {
          created_at?: string
          ecash_address: string
          id?: string
          last_login_at?: string | null
        }
        Update: {
          created_at?: string
          ecash_address?: string
          id?: string
          last_login_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      platform_fee_analytics: {
        Row: {
          avg_fee_xec: number | null
          date: string | null
          total_fees_xec: number | null
          total_payouts: number | null
          total_payouts_xec: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_platform_fees_summary: {
        Args: never
        Returns: {
          avg_fee_per_payout: number
          last_payout_date: string
          total_fees_collected: number
          total_paid_bets: number
          total_payouts_sent: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      bet_position: "yes" | "no"
      bet_status: "pending" | "confirmed" | "won" | "lost" | "refunded"
      prediction_status: "active" | "resolved_yes" | "resolved_no" | "cancelled"
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
      bet_position: ["yes", "no"],
      bet_status: ["pending", "confirmed", "won", "lost", "refunded"],
      prediction_status: ["active", "resolved_yes", "resolved_no", "cancelled"],
    },
  },
} as const
