export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: { id: string; name: string; address: string | null; website: string | null; created_at: string }
        Insert: { id?: string; name: string; address?: string | null; website?: string | null; created_at?: string }
        Update: { id?: string; name?: string; address?: string | null; website?: string | null }
      }
      ads: {
        Row: { id: string; store_id: string | null; image_url: string; sale_start_date: string | null; sale_end_date: string | null; raw_extraction: Json | null; processed_at: string | null; created_at: string }
        Insert: { id?: string; store_id?: string | null; image_url: string; sale_start_date?: string | null; sale_end_date?: string | null; raw_extraction?: Json | null; processed_at?: string | null }
        Update: { image_url?: string; sale_start_date?: string | null; sale_end_date?: string | null; raw_extraction?: Json | null; processed_at?: string | null }
      }
      products: {
        Row: { id: string; name: string; brand: string | null; category: string | null; created_at: string }
        Insert: { id?: string; name: string; brand?: string | null; category?: string | null }
        Update: { name?: string; brand?: string | null; category?: string | null }
      }
      deals: {
        Row: {
          id: string; ad_id: string | null; store_id: string | null; product_id: string | null
          raw_name: string; price: number; unit: string
          base_unit: string | null; package_quantity: number | null; price_per_base_unit: number | null
          deal_type: string | null; multi_buy_qty: number | null; multi_buy_price: number | null
          effective_unit_price: number | null; sale_start_date: string | null; sale_end_date: string | null
          created_at: string
        }
        Insert: {
          id?: string; ad_id?: string | null; store_id?: string | null; product_id?: string | null
          raw_name: string; price: number; unit: string
          base_unit?: string | null; package_quantity?: number | null; price_per_base_unit?: number | null
          deal_type?: string | null; multi_buy_qty?: number | null; multi_buy_price?: number | null
          effective_unit_price?: number | null; sale_start_date?: string | null; sale_end_date?: string | null
        }
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }
      push_subscriptions: {
        Row: { id: string; subscription: Json; created_at: string }
        Insert: { id?: string; subscription: Json }
        Update: { subscription?: Json }
      }
    }
  }
}
