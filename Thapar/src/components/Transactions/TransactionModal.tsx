import { useState } from 'react';
import { X, Banknote, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TransactionModalProps {
  productId: string;
  sellerId: string;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransactionModal({ productId, sellerId, amount, onClose, onSuccess }: TransactionModalProps) {
  const { user } = useAuth();
  // Removed paymentMethod state since we are strictly using COD
  const [meetingLocation, setMeetingLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      // Create the transaction with fixed COD values
      const { error: transactionError } = await (supabase.from('transactions') as any)
        .insert({
          product_id: productId,
          buyer_id: user.id,
          seller_id: sellerId,
          amount,
          payment_method: 'cod',      // Hardcoded to COD
          payment_status: 'pending',  // Hardcoded to pending for COD
          meeting_location: meetingLocation,
        });

      if (transactionError) throw transactionError;

      // Send a message in chat about the purchase initiation
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('product_id', productId)
        .eq('buyer_id', user.id)
        .single();

      // If chat doesn't exist, we might need to handle it, but usually the "Buy" button is inside a chat context or creates one. 
      // Assuming chat exists based on flow. If not, this might fail silently or throw.
      // For robustness, you might want to create a chat if it doesn't exist, but keeping existing logic:
      
      if (!chatError && chatData) {
        const { error: messageError } = await (supabase
          .from('messages') as any)
          .insert({
            chat_id: chatData.id,
            sender_id: user.id,
            // Simplified message since it's always COD
            content: `🛍️ Purchase initiated!\nAmount: ₹${amount}\nPayment Method: Cash on Delivery\nMeeting Location: ${meetingLocation}\n\nWaiting for seller to confirm.`,
            is_read: false
          });

        if (messageError) throw messageError;
      }

      // Only call success callback if all operations completed successfully
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Complete Purchase</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ₹{amount.toLocaleString()}
            </p>
          </div>

          {/* Simplified Payment Method Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Payment Method
            </label>
            <div className="w-full p-4 border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center gap-3">
              <Banknote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Cash on Delivery</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pay when you meet</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Meeting Location on Campus
            </label>
            <input
              type="text"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Near Library, Hostel A Block"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}