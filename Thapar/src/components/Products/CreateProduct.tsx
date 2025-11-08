import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

interface CreateProductProps {
  onClose: () => void;
  onSuccess: () => void;
  product?: Product; // when provided, component acts as edit form
}

const CATEGORIES = [
  'Electronics',
  'Books',
  'Furniture',
  'Clothing',
  'Sports',
  'Musical Instruments',
  'Lab Equipment',
  'Other',
];

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export function CreateProduct({ onClose, onSuccess, product }: CreateProductProps) {
  const { user, isProfileComplete } = useAuth();
  const isEdit = !!product;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    title: product?.title || '',
    description: product?.description || '',
    price: product ? String(product.price) : '',
    category: product?.category || CATEGORIES[0],
    condition: (product?.condition as string) || 'good',
    imageUrl: product?.images?.[0] || '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  // previewUrl removed (not used) - we show filename when selected

  // ✅ Upload image to Supabase storage
  const handleImageUpload = async () => {
    if (!imageFile || !user) return null;

    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, imageFile, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Validate form data
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = 'Valid price is required';
    }
    
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    
    if (!formData.condition) {
      errors.condition = 'Condition is required';
    }
    
    if (!isEdit && !imageFile && !formData.imageUrl) {
      errors.image = 'Image is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check profile completeness
    if (!isProfileComplete) {
      setError('Please complete your profile before creating a listing. Add your phone number and hostel block in your profile.');
      return;
    }

    // Validate form
    if (!validateForm()) {
      setError('Please fill in all required fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Upload image first if selected
      let uploadedImageUrl = formData.imageUrl;
      if (imageFile) {
        const publicUrl = await handleImageUpload();
        uploadedImageUrl = publicUrl || uploadedImageUrl;
      }

      const images = uploadedImageUrl ? [uploadedImageUrl] : [];

          if (isEdit && product) {
            const { error: updateError } = await (supabase.from('products') as any)
              .update({
            title: formData.title,
            description: formData.description,
            price: parseFloat(formData.price),
            category: formData.category,
            condition: formData.condition as
              | 'new'
              | 'like-new'
              | 'good'
              | 'fair'
              | 'poor',
            images: images.length ? images : product.images,
          })
          .eq('id', product.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase.from('products') as any).insert({
          seller_id: user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          category: formData.category,
          condition: formData.condition as
            | 'new'
            | 'like-new'
            | 'good'
            | 'fair'
            | 'poor',
          images,
        });

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  // file change handled inline where inputs are rendered

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            List New Product
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. MacBook Pro 2020"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
              rows={3}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white"
              placeholder="Describe your item..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price (₹)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Condition</label>
            <select
              value={formData.condition}
              onChange={(e) =>
                setFormData({ ...formData, condition: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white"
            >
              {CONDITIONS.map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Local Image Upload */}
          <div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Product Image
  </label>
  <div className="flex gap-2 items-center">
    <input
      type="file"
      accept="image/*"
      id="image-upload"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) setImageFile(file);
      }}
    />
    <button
      type="button"
      onClick={() => document.getElementById('fileInput')?.click()}
      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
    >
      <Upload className="w-4 h-4" /> Upload
    </button>
    <input
  id="fileInput"
  type="file"
  accept="image/*"
  onChange={(e) => {
    if (e.target.files?.[0]) setImageFile(e.target.files[0]);
  }}
  className="hidden"
/>
    {imageFile && (
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {imageFile.name}
      </span>
    )}
  </div>
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
    Upload an image from your computer (stored in Supabase)
  </p>
</div>


          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              {loading ? 'Uploading...' : 'List Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
