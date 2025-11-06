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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          hostel_block: string | null
          avatar_url: string | null
          role: 'buyer' | 'seller' | 'admin'
          reputation_score: number
          is_banned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          phone?: string | null
          hostel_block?: string | null
          avatar_url?: string | null
          role?: 'buyer' | 'seller' | 'admin'
          reputation_score?: number
          is_banned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone?: string | null
          hostel_block?: string | null
          avatar_url?: string | null
          role?: 'buyer' | 'seller' | 'admin'
          reputation_score?: number
          is_banned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          seller_id: string
          title: string
          description: string
          price: number
          category: string
          condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
          images: string[]
          status: 'available' | 'sold' | 'removed'
          views: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          title: string
          description: string
          price: number
          category: string
          condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
          images?: string[]
          status?: 'available' | 'sold' | 'removed'
          views?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          title?: string
          description?: string
          price?: number
          category?: string
          condition?: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
          images?: string[]
          status?: 'available' | 'sold' | 'removed'
          views?: number
          created_at?: string
          updated_at?: string
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          product_id: string
          buyer_id: string
          seller_id: string
          last_message: string | null
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          buyer_id: string
          seller_id: string
          last_message?: string | null
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          buyer_id?: string
          seller_id?: string
          last_message?: string | null
          last_message_at?: string | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          product_id: string
          buyer_id: string
          seller_id: string
          amount: number
          payment_method: 'online' | 'cod'
          payment_status: 'pending' | 'completed' | 'failed'
          delivery_status: 'pending' | 'completed'
          meeting_location: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          buyer_id: string
          seller_id: string
          amount: number
          payment_method: 'online' | 'cod'
          payment_status?: 'pending' | 'completed' | 'failed'
          delivery_status?: 'pending' | 'completed'
          meeting_location?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          buyer_id?: string
          seller_id?: string
          amount?: number
          payment_method?: 'online' | 'cod'
          payment_status?: 'pending' | 'completed' | 'failed'
          delivery_status?: 'pending' | 'completed'
          meeting_location?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      feedback: {
        Row: {
          id: string
          transaction_id: string
          buyer_id: string
          seller_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          buyer_id: string
          seller_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          buyer_id?: string
          seller_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string | null
          product_id: string | null
          reason: string
          description: string | null
          status: 'pending' | 'reviewed' | 'resolved'
          admin_notes: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_user_id?: string | null
          product_id?: string | null
          reason: string
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved'
          admin_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          reporter_id?: string
          reported_user_id?: string | null
          product_id?: string | null
          reason?: string
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved'
          admin_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
      }
    }
  }
}
