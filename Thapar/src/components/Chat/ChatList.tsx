import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle, User } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Chat = Database['public']['Tables']['chats']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface ChatWithDetails extends Chat {
  other_user?: Profile;
  product?: Product;
}

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId: string | null;
}

export function ChatList({ onSelectChat, selectedChatId }: ChatListProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchChats();
      subscribeToChats();
    }
  }, [user]);

  const fetchChats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          product:products(*),
          buyer:profiles!chats_buyer_id_fkey(*),
          seller:profiles!chats_seller_id_fkey(*)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const chatsWithDetails = data?.map((chat: unknown) => {
        const chatData = chat as Chat & {
          buyer: Profile;
          seller: Profile;
          product: Product;
        };
        return {
          ...chatData,
          other_user: chatData.buyer_id === user.id ? chatData.seller : chatData.buyer,
        } as ChatWithDetails;
      }) || [];

      setChats(chatsWithDetails || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChats = () => {
    if (!user) return;

    const channel = supabase
      .channel('chats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `buyer_id=eq.${user.id}`,
        },
        () => {
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MessageCircle className="w-8 h-8 animate-pulse text-blue-600" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Start chatting with sellers</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={`w-full p-4 rounded-lg text-left transition-colors ${
            selectedChatId === chat.id
              ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {chat.other_user ? (
                chat.other_user.full_name.charAt(0).toUpperCase()
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {chat.other_user?.full_name || 'Unknown User'}
                </p>
                {chat.last_message_at && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                    {new Date(chat.last_message_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                {chat.product?.title || 'Product'}
              </p>
              {chat.last_message && (
                <p className="text-sm text-gray-500 dark:text-gray-500 truncate">
                  {chat.last_message}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
