import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Transaction = {
  id: string;
  created_at: string;
  amount: number;
  buyer: { full_name: string; avatar_url: string | null };
  seller: { full_name: string; avatar_url: string | null };
  product: Product;
};

export function SoldCarousel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('transactions')
          .select(`
            *,
            buyer:profiles!transactions_buyer_id_fkey(full_name, avatar_url),
            seller:profiles!transactions_seller_id_fkey(full_name, avatar_url),
            product:products(*)
          `)
          .order('created_at', { ascending: false })
          .limit(20); // limit to recent 20 transactions for performance

        if (error) throw error;
        if (!mounted) return;
        setTransactions(data || []);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30000); // refresh every 30s
    return () => { 
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || transactions.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Purchases</h2>

      <div className="w-full rounded-lg">
        {/* Horizontal scroll container - manual scroll instead of automatic marquee */}
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-4 py-2 px-1">
            {transactions.map((t) => {
            if (!t.product) return null; // skip if product is missing
            const image = Array.isArray(t.product.images) && t.product.images.length > 0 
              ? t.product.images[0] 
              : 'https://images.pexels.com/photos/3846490/pexels-photo-3846490.jpeg';

            return (
              <div
                key={t.id}
                className="flex-shrink-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm"
              >
                <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden flex items-center justify-center">
                  <img
                    src={image}
                    alt={t.product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.product.title}</h3>
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded">Purchased</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 truncate">₹{t.product.price?.toLocaleString?.() ?? t.product.price}</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 dark:text-blue-400">Buyer:</span>
                      <span className="text-gray-700 dark:text-gray-300">{t.buyer?.full_name || 'Anonymous'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 dark:text-blue-400">Seller:</span>
                      <span className="text-gray-700 dark:text-gray-300">{t.seller?.full_name || 'Anonymous'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 dark:text-blue-400">Date:</span>
                      <time className="text-gray-700 dark:text-gray-300">{new Date(t.created_at).toLocaleDateString()}</time>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
