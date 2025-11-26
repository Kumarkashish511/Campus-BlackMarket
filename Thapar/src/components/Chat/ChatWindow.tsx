import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, ShoppingBag, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Database } from '../../lib/database.types';

// Extended Message type to handle images locally even if DB types aren't fully updated in TS yet
type Message = Database['public']['Tables']['messages']['Row'] & {
  message_type?: 'text' | 'image' | 'transaction';
  image_url?: string | null;
};

type Chat = Database['public']['Tables']['chats']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false); // State for image upload loading
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  useEffect(() => {
    if (chatId) {
      fetchChatDetails();
      fetchMessages();
      const subscription = subscribeToMessages();
      // Cleanup subscription on unmount or chatId change
      return () => {
        subscription.unsubscribe();
      };
    }
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
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      if (user) {
        await (supabase.from('messages') as any)
          .update({ is_read: true })
          .eq('chat_id', chatId)
          .neq('sender_id', user.id);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // FIX: Check for duplicates before adding to state
          // This prevents the message from appearing twice since we now add it manually too
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          if (newMessage.sender_id !== user?.id && user) {
            (supabase.from('messages') as any)
              .update({ is_read: true })
              .eq('id', newMessage.id)
              .eq('chat_id', chatId);
          }
        }
      )
      .subscribe();

    return channel;
  };

  // --- NEW: Image Upload Handler ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chat-images') // Ensure this bucket exists in Supabase
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      // 3. Insert Message & Get it back immediately
      const { data: newMessageData, error: insertError } = await (supabase.from('messages') as any)
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: 'Sent an image', // Fallback text
          image_url: publicUrl,
          message_type: 'image',
        })
        .select()
        .single(); // Crucial for getting ID back

      if (insertError) throw insertError;

      // 4. Instant State Update
      if (newMessageData) {
        setMessages((prev) => [...prev, newMessageData as Message]);
      }

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to send image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      // FIX: Use .select().single() to get the message object back immediately
      const { data: newMessageData, error: messageError } = await (supabase.from('messages') as any)
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: messageContent,
          message_type: 'text',
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // FIX: Manually add to state for instant feedback
      if (newMessageData) {
        setMessages((prev) => [...prev, newMessageData as Message]);
      }

      await (supabase.from('chats') as any)
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', chatId);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restore message on failure
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {otherUser?.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {otherUser?.full_name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {product?.title}
              </p>
            </div>
          </div>
          {product && user?.id === chat?.buyer_id && (
            <button
              onClick={() => onInitiateTransaction(product.id, product.seller_id, product.price)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Buy Now
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isSender = message.sender_id === user?.id;
          return (
            <div
              key={message.id}
              className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                  isSender
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                {/* --- NEW: Logic to display Image OR Text --- */}
                {message.message_type === 'image' && message.image_url ? (
                  <div className="mb-1">
                    <img 
                      src={message.image_url} 
                      alt="Attachment" 
                      className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90"
                      onClick={() => window.open(message.image_url!, '_blank')}
                    />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                
                <span
                  className={`text-xs mt-1 block ${
                    isSender ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
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
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2 items-center">
          {/* --- NEW: Hidden Input and Image Button --- */}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Send Image/QR"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}