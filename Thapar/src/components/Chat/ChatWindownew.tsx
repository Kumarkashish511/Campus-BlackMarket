import { useState, useEffect, useRef } from 'react';
import { Send, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';
import { TransactionMessage } from './TransactionMessage';

type Message = Database['public']['Tables']['messages']['Row'] & {
  message_type?: 'text' | 'transaction' | 'transaction_update';
};
type Chat = Database['public']['Tables']['chats']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

interface ChatWindowProps {
  chatId: string;
  onInitiateTransaction: (productId: string, sellerId: string, amount: number) => void;
}

export function ChatWindow({ chatId, onInitiateTransaction }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId) {
      fetchChatDetails();
      fetchMessages();
      subscribeToMessages();
    }
    return () => {
      supabase.removeAllChannels();
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          product:products(*),
          buyer:profiles!chats_buyer_id_fkey(*),
          seller:profiles!chats_seller_id_fkey(*)
        `)
        .eq('id', chatId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setChat(data as unknown as Chat);
        setProduct((data as { product: Product }).product);
        const otherUserData = (data as Chat).buyer_id === user?.id
          ? (data as { seller: Profile }).seller
          : (data as { buyer: Profile }).buyer;
        setOtherUser(otherUserData);
        
        // Fetch active transaction
        const { data: transactionData } = await supabase
          .from('transactions')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        setTransaction(transactionData);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (data) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const subscribeToMessages = () => {
    supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();
  };

  const handleConfirmPayment = async () => {
    if (!transaction) return;

    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .update({ payment_status: 'confirmed' as const })
        .eq('id', transaction.id)
        .select();

      if (transactions?.[0]) {
        setTransaction(transactions[0]);
      }

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user!.id,
        content: 'Payment has been confirmed.',
        message_type: 'text',
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
    }
  };

  const handleMarkAsSold = async () => {
    if (!transaction || !product) return;

    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .update({ payment_status: 'completed' as const })
        .eq('id', transaction.id)
        .select();

      if (transactions?.[0]) {
        setTransaction(transactions[0]);
      }

      await supabase
        .from('products')
        .update({ status: 'sold' as const, sold_at: new Date().toISOString() })
        .eq('id', product.id);

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user!.id,
        content: 'The item has been marked as sold.',
        message_type: 'text',
      });
    } catch (error) {
      console.error('Error marking as sold:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        content: newMessage.trim(),
        message_type: 'text' as const,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = (message: Message) => {
    const isCurrentUser = message.sender_id === user?.id;

    if (message.message_type === 'transaction' && transaction) {
      return (
        <TransactionMessage
          key={message.id}
          transaction={transaction}
          isSeller={chat?.seller_id === user?.id}
          onConfirmPayment={handleConfirmPayment}
          onMarkAsSold={handleMarkAsSold}
        />
      );
    }

    return (
      <div
        key={message.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[70%] px-4 py-2 rounded-lg ${
            isCurrentUser
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <span
            className={`text-xs mt-1 block ${
              isCurrentUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    );
  };

  const handleInitiateTransaction = () => {
    if (!product || !chat || !user) return;
    onInitiateTransaction(product.id, chat.seller_id, product.price);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <div>
          <h2 className="font-semibold">{product?.title}</h2>
          <p className="text-sm text-gray-500">{otherUser?.full_name}</p>
        </div>
        {chat?.buyer_id === user?.id && !transaction && (
          <button
            onClick={handleInitiateTransaction}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Buy</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => renderMessage(message))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}