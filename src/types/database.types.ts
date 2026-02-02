export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          cnpj: string | null
          phone: string | null
          supabase_schema: string | null
          tenant_type: 'company' | 'branch'
          parent_tenant_id: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          cnpj?: string | null
          phone?: string | null
          supabase_schema?: string | null
          tenant_type?: 'company' | 'branch'
          parent_tenant_id?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          cnpj?: string | null
          phone?: string | null
          supabase_schema?: string | null
          tenant_type?: 'company' | 'branch'
          parent_tenant_id?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          tenant_id: string | null
          full_name: string
          avatar_url: string | null
          role: 'superadmin' | 'admin' | 'user' | 'viewer'
          can_switch_tenants: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id?: string | null
          full_name: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'user' | 'viewer'
          can_switch_tenants?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          full_name?: string
          avatar_url?: string | null
          role?: 'superadmin' | 'admin' | 'user' | 'viewer'
          can_switch_tenants?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_tenant_access: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          granted_at: string
          granted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          granted_at?: string
          granted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          granted_at?: string
          granted_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          branch_code: string
          tenant_id: string
          store_code: string | null
          descricao: string | null
          cep: string | null
          rua: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          branch_code: string
          tenant_id: string
          store_code?: string | null
          descricao?: string | null
          cep?: string | null
          rua?: string | null
          numero?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
        }
        Update: {
          branch_code?: string
          tenant_id?: string
          store_code?: string | null
          descricao?: string | null
          cep?: string | null
          rua?: string | null
          numero?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setores: {
        Row: {
          id: number
          nome: string
          departamento_nivel: number
          departamento_ids: number[]
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          nome: string
          departamento_nivel: number
          departamento_ids: number[]
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          nome?: string
          departamento_nivel?: number
          departamento_ids?: number[]
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
