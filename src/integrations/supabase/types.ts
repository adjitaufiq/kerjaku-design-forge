export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_credits: {
        Row: {
          balance: number;
          created_at: string;
          id: string;
          plan: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          id?: string;
          plan?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          id?: string;
          plan?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_credits_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          cost: number;
          created_at: string;
          id: string;
          image_url: string | null;
          model: string;
          project_id: string | null;
          prompt: string | null;
          status: Database["public"]["Enums"]["generation_status"];
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          model?: string;
          project_id?: string | null;
          prompt?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          model?: string;
          project_id?: string | null;
          prompt?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      consultations: {
        Row: {
          budget_range: string | null;
          client_requirement: string | null;
          color_preference: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          project_id: string;
          special_request: string | null;
          style_preference: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          budget_range?: string | null;
          client_requirement?: string | null;
          color_preference?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id: string;
          special_request?: string | null;
          style_preference?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          budget_range?: string | null;
          client_requirement?: string | null;
          color_preference?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id?: string;
          special_request?: string | null;
          style_preference?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_activities: {
        Row: {
          body: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          lead_id: string;
          title: string;
          type: Database["public"]["Enums"]["activity_type"];
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          lead_id: string;
          title: string;
          type?: Database["public"]["Enums"]["activity_type"];
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          lead_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["activity_type"];
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          client_name: string;
          created_at: string;
          email: string | null;
          id: string;
          location: string | null;
          next_follow_up: string | null;
          owner_id: string | null;
          phone: string | null;
          source: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          client_name: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          location?: string | null;
          next_follow_up?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          client_name?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          location?: string | null;
          next_follow_up?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          avatar?: string | null;
          created_at?: string;
          email?: string;
          id: string;
          name?: string;
          updated_at?: string;
        };
        Update: {
          avatar?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_assets: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          type: Database["public"]["Enums"]["asset_type"];
          url: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          type: Database["public"]["Enums"]["asset_type"];
          url: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          type?: Database["public"]["Enums"]["asset_type"];
          url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_assets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          estimated_value: number;
          id: string;
          lead_id: string | null;
          project_name: string;
          project_type: Database["public"]["Enums"]["project_type"];
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          estimated_value?: number;
          id?: string;
          lead_id?: string | null;
          project_name: string;
          project_type?: Database["public"]["Enums"]["project_type"];
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          estimated_value?: number;
          id?: string;
          lead_id?: string | null;
          project_name?: string;
          project_type?: Database["public"]["Enums"]["project_type"];
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      proposal_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          position: number;
          price: number;
          proposal_id: string;
          quantity: number;
          subtotal: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          price?: number;
          proposal_id: string;
          quantity?: number;
          subtotal?: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          price?: number;
          proposal_id?: string;
          quantity?: number;
          subtotal?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposal_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      proposal_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          pdf_url: string | null;
          proposal_id: string;
          total_amount: number;
          version: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pdf_url?: string | null;
          proposal_id: string;
          total_amount?: number;
          version?: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pdf_url?: string | null;
          proposal_id?: string;
          total_amount?: number;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposal_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          concept_note: string | null;
          created_at: string;
          id: string;
          material_spec: string | null;
          pdf_url: string | null;
          project_id: string;
          scope_of_work: string | null;
          share_token: string;
          status: Database["public"]["Enums"]["proposal_status"];
          terms: string | null;
          title: string;
          total_amount: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          concept_note?: string | null;
          created_at?: string;
          id?: string;
          material_spec?: string | null;
          pdf_url?: string | null;
          project_id: string;
          scope_of_work?: string | null;
          share_token?: string;
          status?: Database["public"]["Enums"]["proposal_status"];
          terms?: string | null;
          title?: string;
          total_amount?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          concept_note?: string | null;
          created_at?: string;
          id?: string;
          material_spec?: string | null;
          pdf_url?: string | null;
          project_id?: string;
          scope_of_work?: string | null;
          share_token?: string;
          status?: Database["public"]["Enums"]["proposal_status"];
          terms?: string | null;
          title?: string;
          total_amount?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workshops: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          logo: string | null;
          name: string;
          phone: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo?: string | null;
          name: string;
          phone?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo?: string | null;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workshops_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          logo: string | null;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          logo?: string | null;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          logo?: string | null;
          name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _workspace_id: string;
        };
        Returns: boolean;
      };
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean };
      my_workspace_ids: { Args: never; Returns: string[] };
    };
    Enums: {
      activity_type:
        | "NOTE"
        | "STAGE_CHANGE"
        | "FOLLOW_UP"
        | "PROPOSAL_SENT"
        | "AI_CONCEPT"
        | "CALL"
        | "WHATSAPP"
        | "MEETING";
      app_role: "admin_workshop" | "sales" | "designer";
      asset_type: "CLIENT_PHOTO" | "PINTEREST_REFERENCE" | "SKETCHUP_RENDER";
      generation_status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
      lead_status:
        | "NEW"
        | "CONSULTATION"
        | "AI_CONCEPT"
        | "PROPOSAL"
        | "NEGOTIATION"
        | "DEAL"
        | "COMPLETED"
        | "PRODUCTION";
      project_status: "DRAFT" | "DESIGN" | "PROPOSAL" | "PRODUCTION" | "COMPLETED";
      project_type: "KITCHEN_SET" | "WARDROBE" | "BEDROOM_INTERIOR" | "OFFICE_INTERIOR" | "OTHER";
      proposal_status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "NOTE",
        "STAGE_CHANGE",
        "FOLLOW_UP",
        "PROPOSAL_SENT",
        "AI_CONCEPT",
        "CALL",
        "WHATSAPP",
        "MEETING",
      ],
      app_role: ["admin_workshop", "sales", "designer"],
      asset_type: ["CLIENT_PHOTO", "PINTEREST_REFERENCE", "SKETCHUP_RENDER"],
      generation_status: ["PENDING", "PROCESSING", "SUCCESS", "FAILED"],
      lead_status: [
        "NEW",
        "CONSULTATION",
        "AI_CONCEPT",
        "PROPOSAL",
        "NEGOTIATION",
        "DEAL",
        "COMPLETED",
        "PRODUCTION",
      ],
      project_status: ["DRAFT", "DESIGN", "PROPOSAL", "PRODUCTION", "COMPLETED"],
      project_type: ["KITCHEN_SET", "WARDROBE", "BEDROOM_INTERIOR", "OFFICE_INTERIOR", "OTHER"],
      proposal_status: ["DRAFT", "SENT", "APPROVED", "REJECTED"],
    },
  },
} as const;
