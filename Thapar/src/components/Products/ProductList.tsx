import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { Loader2 } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductListProps {
  searchQuery: string;
  category: string;
  sortBy: string;
  onInitiateTransaction: (productId: string, sellerId: string, amount: number) => void;
}

export function ProductList({ searchQuery, category, sortBy, onInitiateTransaction }: ProductListProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
    if (user) {
      fetchWishlist();
    }
  }, [searchQuery, category, sortBy, user]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('products')
        .select('*')
        .eq('status', 'available');

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (sortBy === 'price-low') {
        query = query.order('price', { ascending: true });
      } else if (sortBy === 'price-high') {
        query = query.order('price', { ascending: false });
      } else if (sortBy === 'popular') {
        query = query.order('views', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('wishlists')
        .select('product_id')
        .eq('user_id', user.id);

      if (error) throw error;
  setWishlistedIds(new Set((data?.map((w: any) => w.product_id) || [])));
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) return;

    try {
      if (wishlistedIds.has(productId)) {
        const { error } = await (supabase as any)
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;
        setWishlistedIds(prev => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      } else {
        const { error } = await (supabase as any)
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: productId,
          });

        if (error) throw error;
        setWishlistedIds(prev => new Set(prev).add(productId));
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const handleProductClick = async (product: Product) => {
    await (supabase as any)
      .from('products')
      .update({ views: product.views + 1 })
      .eq('id', product.id);

    setSelectedProduct(product);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No products found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onWishlist={() => toggleWishlist(product.id)}
            isWishlisted={wishlistedIds.has(product.id)}
            onClick={() => handleProductClick(product)}
          />
        ))}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onInitiateTransaction={onInitiateTransaction}
          onEditSuccess={() => {
            setSelectedProduct(null);
            fetchProducts();
          }}
        />
      )}
    </>
  );
}
