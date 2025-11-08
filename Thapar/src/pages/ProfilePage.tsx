import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Star, Package, Heart, Edit2, Save } from 'lucide-react';
import { ProductModal } from '../components/Products/ProductModal';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

export function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'wishlist' | 'purchases'>('listings');
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewedTransactionIds, setReviewedTransactionIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    hostel_block: profile?.hostel_block || '',
  });
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);

  const fetchPendingTransactions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        product:products(*),
        buyer:profiles!transactions_buyer_id_fkey(*)
      `)
      .eq('seller_id', user.id)
      .eq('payment_status', 'pending');

    if (!error && data) {
      setPendingTransactions(data);
    }
  };

  const handleConfirmPayment = async (transactionId: string, productId: string, markAsSold: boolean) => {
    try {
      // Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({ payment_status: 'completed' })
        .eq('id', transactionId);

      if (transactionError) throw transactionError;

      // Mark product as sold if seller chooses to
      if (markAsSold) {
        const { error: productError } = await supabase
          .from('products')
          .update({ status: 'sold' })
          .eq('id', productId);

        if (productError) throw productError;
      }

      // Refresh pending transactions
      fetchPendingTransactions();
    } catch (error) {
      console.error('Error confirming payment:', error);
    }
  };
  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  useEffect(() => {
    if (user) {
      fetchMyProducts();
      fetchWishlist();
      fetchPendingTransactions();
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchPurchases();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        phone: profile.phone || '',
        hostel_block: profile.hostel_block || '',
      });
    }
  }, [profile]);

  const fetchMyProducts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        // only show non-deleted products; you can adjust to include sold if you want
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWishlist = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('product:products(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      // map and filter out null/missing products (e.g., deleted by seller)
      const products = (data || []).map((w: any) => w.product).filter((p: any) => p && p.id);
      setWishlist(products as Product[]);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const fetchPurchases = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('transactions')
        .select(`
          id,
          buyer_id,
          seller_id,
          amount,
          created_at,
          payment_status,
          product:products(*),
          seller:profiles!transactions_seller_id_fkey(
            id,
            full_name,
            avatar_url,
            reputation_score,
            hostel_block
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Only show transactions with completed payment status
      const completedTransactions = (data || []).filter(
        transaction => transaction.payment_status === 'completed'
      );
      setPurchases(completedTransactions);
      // load which of these transactions are already reviewed by this buyer
      fetchReviewedTransactions();
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const fetchReviewedTransactions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('transaction_id')
        .eq('buyer_id', user.id);

      if (error) throw error;
      const ids = new Set((data || []).map((r: any) => r.transaction_id));
      setReviewedTransactionIds(ids);
    } catch (error) {
      console.error('Error fetching reviewed transactions:', error);
    }
  };

  const fetchReviews = async () => {
    if (!profile) return;
    try {
      // Use explicit relationship names to avoid ambiguous embedding (buyer vs seller)
      const { data, error } = await (supabase.from('feedback') as any)
        .select(
          '*, buyer:profiles!feedback_buyer_id_fkey(full_name, avatar_url), seller:profiles!feedback_seller_id_fkey(full_name, avatar_url)'
        )
        .eq('seller_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  useEffect(() => {
    if (profile) fetchReviews();
  }, [profile]);

  const handleSaveProfile = async () => {
    const { error } = await updateProfile(formData);
    if (!error) {
      setEditing(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      // refresh both lists
      await fetchMyProducts();
      await fetchWishlist();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const navigate = useNavigate();

  const handleInitiateTransaction = async (productId: string, sellerId: string, amount: number) => {
    if (!user) {
      alert('Please sign in to buy');
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('transactions')
        .insert({
          product_id: productId,
          buyer_id: user.id,
          seller_id: sellerId,
          amount,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      // refresh purchases and close modal
      await fetchPurchases();
        // return success to caller (modal will close on success)
        return data;
    } catch (err) {
      console.error('Error initiating transaction:', err);
        // propagate error so caller (ProductModal) can show a friendly message
        throw err;
    }
  };

  const submitReview = async () => {
    if (!user || !activeTransaction) return;
    setReviewError('');
    setReviewLoading(true);

    try {
      // Check existing feedback for this transaction
      const { data: existing, error: existingErr } = await (supabase.from('feedback') as any)
        .select('id')
        .eq('transaction_id', activeTransaction.id)
        .maybeSingle();

      if (existingErr) throw existingErr;
      if (existing) {
        setReviewError('You have already reviewed this transaction.');
        setReviewLoading(false);
        return;
      }

      const { error: insertErr } = await (supabase.from('feedback') as any).insert({
        transaction_id: activeTransaction.id,
        buyer_id: user.id,
        seller_id: activeTransaction.seller_id,
        rating: reviewRating,
        comment: reviewComment || null,
      });

      if (insertErr) throw insertErr;

      // Recalculate seller reputation
      const { data: allFeedback, error: allErr } = await (supabase.from('feedback') as any)
        .select('rating')
        .eq('seller_id', activeTransaction.seller_id);

      if (allErr) throw allErr;

      const ratings = (allFeedback || []).map((r: any) => Number(r.rating));
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

      const { error: updateProfileErr } = await (supabase.from('profiles') as any)
        .update({ reputation_score: avg })
        .eq('id', activeTransaction.seller_id);

      if (updateProfileErr) throw updateProfileErr;

      // update local state
      setReviewedTransactionIds(prev => new Set(prev).add(activeTransaction.id));
      fetchReviews();
      setShowReviewModal(false);
      setActiveTransaction(null);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {profile?.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                {editing ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="text-2xl font-bold mb-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profile?.full_name}
                  </h2>
                )}
                <p className="text-gray-600 dark:text-gray-400">{profile?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {profile?.reputation_score.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">rating</span>
                </div>
                {/* Recent reviews preview */}
                {reviews.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Reviews</h4>
                    <ul className="mt-2 space-y-2">
                      {reviews.slice(0,3).map((r) => (
                        <li key={r.id} className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{r.buyer?.full_name || 'Buyer'}</span>: {r.rating} ★ {r.comment ? `— ${r.comment}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => editing ? handleSaveProfile() : setEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {editing ? (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4" />
                  Edit
                </>
              )}
            </button>
          </div>
          {showReviewModal && activeTransaction && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div
                className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Leave a Review</h2>
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Rate your experience with the seller</p>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setReviewRating(n)}
                        className={`text-2xl ${reviewRating >= n ? 'text-yellow-400' : 'text-gray-300'}`}
                        type="button"
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="Optional comment"
                    />
                  </div>
                  {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowReviewModal(false)}
                      className="flex-1 py-2 px-3 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitReview}
                      disabled={reviewLoading}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      {reviewLoading ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showProductModal && selectedProduct && (
            <ProductModal
              product={selectedProduct}
              onClose={async () => {
                closeProductModal();
                // refresh lists to reflect any wishlist or status changes made inside the modal
                await fetchMyProducts();
                await fetchWishlist();
              }}
              onInitiateTransaction={handleInitiateTransaction}
              onEditSuccess={async () => {
                await fetchMyProducts();
                await fetchWishlist();
              }}
            />
          )}

          {pendingTransactions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Pending Payments
              </h3>
              <div className="space-y-4">
                {pendingTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {transaction.product.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Buyer: {transaction.buyer.full_name}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        ₹{transaction.amount}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleConfirmPayment(transaction.id, transaction.product_id, true)}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                      >
                        Confirm & Mark as Sold
                      </button>
                      <button
                        onClick={() => handleConfirmPayment(transaction.id, transaction.product_id, false)}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                      >
                        Confirm Payment Only
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{profile?.phone || 'Not set'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hostel Block
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.hostel_block}
                  onChange={(e) => setFormData({ ...formData, hostel_block: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., A Block"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{profile?.hostel_block || 'Not set'}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('listings')}
                className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'listings'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                My Listings ({myProducts.length})
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'wishlist'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Heart className="w-5 h-5" />
                Wishlist ({wishlist.length})
              </button>
              <button
                onClick={() => setActiveTab('purchases')}
                className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'purchases'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                Purchases ({purchases.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'listings' && (
              <div className="space-y-4">
                  {myProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No listings yet</p>
                  </div>
                ) : (
                  myProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => openProductModal(product)}
                      className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                    >
                      <img
                        src={product.images[0] || 'https://images.pexels.com/photos/3846490/pexels-photo-3846490.jpeg'}
                        alt={product.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {product.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {product.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            ₹{product.price.toLocaleString()}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {product.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                        className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div className="space-y-4">
                {wishlist.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No items in wishlist</p>
                  </div>
                ) : (
                  wishlist
                    .filter((p) => p && (p as any).id)
                    .map((product) => {
                      const prod = product as Product | null;
                      if (!prod) return null;
                      const image = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : 'https://images.pexels.com/photos/3846490/pexels-photo-3846490.jpeg';
                      return (
                        <div
                          key={prod.id}
                          onClick={() => openProductModal(prod)}
                          className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                        >
                          <img
                            src={image}
                            alt={prod.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {prod.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                              {prod.description}
                            </p>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              ₹{prod.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
            {activeTab === 'purchases' && (
              <div className="space-y-4">
                {purchases.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No purchases yet</p>
                  </div>
                ) : (
                  purchases.map((transaction) => {
                    // Support multiple possible embed shapes: transaction.product (object), transaction.products (object or array)
                    let product: Product | null = null;
                    if (transaction.product) {
                      product = transaction.product as Product;
                    } else if (transaction.products) {
                      // could be object or array
                      if (Array.isArray(transaction.products)) {
                        product = transaction.products[0] as Product | undefined || null;
                      } else {
                        product = transaction.products as Product;
                      }
                    }

                    return (
                      <div
                        key={transaction.id}
                        className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg items-center"
                      >
                        {/* Show default image for unavailable products */}
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                          <img
                            src="https://images.pexels.com/photos/3846490/pexels-photo-3846490.jpeg"
                            alt="Default product"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Item no longer available
                            </h3>
                            <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                              Purchase #{transaction.id.slice(0, 8)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p>Seller: {transaction.seller?.full_name || 'Unknown'}</p>
                            <p>Date: {new Date(transaction.created_at).toLocaleDateString()}</p>
                            <p>Amount: ₹{transaction.amount?.toLocaleString()}</p>
                            {transaction.seller?.hostel_block && (
                              <p>Hostel: {transaction.seller.hostel_block}</p>
                            )}
                          </div>
                          {!reviewedTransactionIds.has(transaction.id) && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  setActiveTransaction(transaction);
                                  setShowReviewModal(true);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                              >
                                Leave Review
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    const image = product.images?.[0] || 'https://images.pexels.com/photos/3846490/pexels-photo-3846490.jpeg';
                    return (
                      <div
                        key={transaction.id}
                        className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      >
                        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={image}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0"> {/* min-w-0 helps with text truncation */}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {product.title}
                            </h3>
                            <span className="flex-shrink-0 text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                              #{transaction.id.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                            {product.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              ₹{product.price.toLocaleString()}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              {product.status}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Seller: {transaction.seller?.full_name || 'Unknown'}
                              {transaction.seller?.hostel_block && ` • ${transaction.seller.hostel_block}`}
                            </div>
                            {!reviewedTransactionIds.has(transaction.id) ? (
                              <button
                                onClick={() => {
                                  setActiveTransaction(transaction);
                                  setShowReviewModal(true);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex-shrink-0"
                              >
                                Leave Review
                              </button>
                            ) : (
                              <span className="text-sm text-gray-500">Reviewed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
