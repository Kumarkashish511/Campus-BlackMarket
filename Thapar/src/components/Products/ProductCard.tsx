import { Heart, Eye } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductCardProps {
  product: Product;
  onWishlist: () => void;
  isWishlisted: boolean;
  onClick: () => void;
}

export function ProductCard({ product, onWishlist, isWishlisted, onClick }: ProductCardProps) {
  let imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';

  if (product.images) {
    // Handles both string or array types
    const images =
      typeof product.images === 'string'
        ? [product.images]
        : Array.isArray(product.images)
        ? product.images
        : [];


    if (Array.isArray(images) && images.length > 0) {
      imageUrl = images[0];
    }
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={imageUrl}
          alt={product.title}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onWishlist();
          }}
          className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <Heart
            className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-300'}`}
          />
        </button>
        <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded-full flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {product.views}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
          {product.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
          {product.description}
        </p>

        <div className="flex items-center justify-between mt-3">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ₹{product.price.toLocaleString()}
          </span>
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
            {product.condition}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
            {product.category}
          </span>
          <span>
            {new Date(product.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
