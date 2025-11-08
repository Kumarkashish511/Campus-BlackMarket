import { useState, useEffect } from 'react';
import { X, MessageCircle, Star, MapPin, ShoppingBag, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../../lib/database.types';
import { CreateProduct } from './CreateProduct';

type Product = Database['public']['Tables']['products']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onInitiateTransaction: (productId: string, sellerId: string, amount: number) => void;
  onEditSuccess?: () => void; // optional callback to refresh parent lists after edit/sold
}

export function ProductModal({ product, onClose, onInitiateTransaction }: ProductModalProps) {
  const { user, isProfileComplete } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSeller();
    if (user) {
      checkWishlist();
    }
  }, [product.seller_id, user]);

  const fetchSeller = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', product.seller_id)
        .maybeSingle();

      if (error) throw error;
      setSeller(data);
    } catch (error) {
      console.error('Error fetching seller:', error);
    }
  };

  const markAsSold = async () => {
    if (!user || user.id !== product.seller_id) return;
    try {
      const { error } = await (supabase as any)
        .from('products')
        .update({ status: 'sold' })
        .eq('id', product.id);
      if (error) throw error;
      // inform parent to refresh lists if provided
      onClose();
    } catch (err) {
      console.error('Error marking product sold:', err);
    }
  };

  const checkWishlist = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsWishlisted(!!data);
    } catch (error) {
      console.error('Error checking wishlist:', error);
    }
  };

  const toggleWishlist = async () => {
    if (!user || loadingWishlist) return;

    setLoadingWishlist(true);
    try {
      if (isWishlisted) {
        const { error } = await (supabase as any)
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);

        if (error) throw error;
        setIsWishlisted(false);
      } else {
        const { error } = await (supabase as any)
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });

        if (error) throw error;
        setIsWishlisted(true);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    } finally {
      setLoadingWishlist(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;

    try {
      const { data: existingChat, error: existingError } = await (supabase as any)
        .from('chats')
        .select('id')
        .eq('product_id', product.id)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingChat) {
        console.log('Existing chat found:', existingChat);
        navigate(`/chat/${existingChat.id}?seller=${product.seller_id}`);
        onClose();
        return;
      } else {
        const { data: newChat, error: insertError} = await (supabase as any)
          .from('chats')
          .insert({
            product_id: product.id,
            buyer_id: user.id,
            seller_id: product.seller_id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

    console.log('New chat created:', newChat);
    navigate(`/chat/${newChat.id}?seller=${product.seller_id}`);
    onClose();
        if (newChat) {
          navigate(`/chat/${newChat.id}?seller=${product.seller_id}`);
        }
      }
      onClose();
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const images =
  typeof product.images === 'string'
    ? [product.images]
    : Array.isArray(product.images)
    ? product.images
    : [];

  const imageUrl =
  images.length > 0
    ? images[currentImageIndex]
    : 'https://via.placeholder.com/400x300?text=No+Image';

  // if editing, show CreateProduct modal instead
  if (isEditing) {
    return (
      <CreateProduct
        onClose={() => setIsEditing(false)}
        onSuccess={() => {
          setIsEditing(false);
          onClose();
          // parent can refresh lists by passing onEditSuccess through ProductModalProps if needed
          // we call it here if provided
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          (async () => {
            try {
              // no-op placeholder
            } catch {}
          })();
        }}
        product={product}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Product Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

                <div className="grid md:grid-cols-2 gap-6 p-6">
          <div>
            <div className="relative h-80 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mb-4">
              <img
                src={imageUrl}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      idx === currentImageIndex
                        ? 'border-blue-600'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {product.title}
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{product.price.toLocaleString()}
                </span>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full">
                  {product.condition}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {product.description}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Category:</span>
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                  {product.category}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Listed:</span>
                <span>{new Date(product.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {seller && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Seller Information</h4>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {seller.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{seller.full_name}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {seller.reputation_score.toFixed(1)} rating
                      </span>
                    </div>
                  </div>
                </div>
                {seller.hostel_block && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{seller.hostel_block}</span>
                  </div>
                )}
              </div>
            )}

            {user && user.id !== product.seller_id && product.status === 'available' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={toggleWishlist}
                    disabled={loadingWishlist}
                    className={`py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      isWishlisted
                        ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                    {isWishlisted ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={async () => {
                      // Check profile completeness before purchase
                      if (!isProfileComplete) {
                        setPurchaseError('Please complete your profile (add phone number and hostel block) before making a purchase.');
                        return;
                      }
                      
                      // await parent handler and show errors if any
                      if (purchaseLoading) return;
                      setPurchaseError('');
                      setPurchaseLoading(true);
                      try {
                        await onInitiateTransaction(product.id, product.seller_id, product.price);
                        // only close on success
                        onClose();
                      } catch (err: unknown) {
                        console.error('Purchase error:', err);
                        setPurchaseError('Sorry, purchase cannot be made now. Please try again later.');
                      } finally {
                        setPurchaseLoading(false);
                      }
                    }}
                    className="py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    {purchaseLoading ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
                <button
                  onClick={handleStartChat}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Contact Seller
                </button>
                {purchaseError && <p className="text-sm text-red-600">{purchaseError}</p>}
              </div>
            )}
            {user && user.id === product.seller_id && product.status !== 'sold' && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-3 px-4 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={markAsSold}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Mark as Sold
                </button>
              </div>
            )}

            {product.status === 'sold' && (
              <div className="mt-4">
                <span className="inline-block px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  Sold
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

