import { useState, useEffect } from 'react';
import { ChatList } from '../components/Chat/ChatList';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { MessageCircle } from 'lucide-react';

interface ChatPageProps {
  onInitiateTransaction: (productId: string, sellerId: string, amount: number) => void;
}

export function ChatPage({ onInitiateTransaction }: ChatPageProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#chat-')) {
      const chatId = hash.replace('#chat-', '');
      setSelectedChatId(chatId);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 12rem)' }}>
          <div className="grid md:grid-cols-3 h-full">
            <div className="md:col-span-1 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h2>
              </div>
              <div className="p-4">
                <ChatList
                  onSelectChat={setSelectedChatId}
                  selectedChatId={selectedChatId}
                />
              </div>
            </div>

            <div className="md:col-span-2 hidden md:block">
              {selectedChatId ? (
                <ChatWindow
                  chatId={selectedChatId}
                  onInitiateTransaction={onInitiateTransaction}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <MessageCircle className="w-16 h-16 mb-4" />
                  <p className="text-lg">Select a conversation to start chatting</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
