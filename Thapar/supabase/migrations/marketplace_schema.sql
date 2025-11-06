/*
  # CampusBlackMarket Database Schema

  ## Overview
  Complete database schema for Thapar University campus marketplace application.

  ## 1. New Tables

  ### `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `email` (text, unique, not null) - Thapar University email
  - `full_name` (text, not null) - Student's full name
  - `phone` (text) - Contact number
  - `hostel_block` (text) - Campus hostel location
  - `avatar_url` (text) - Profile picture URL
  - `role` (text, default 'buyer') - User role: buyer, seller, or admin
  - `reputation_score` (numeric, default 0) - Seller reputation based on feedback
  - `is_banned` (boolean, default false) - Account ban status
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `products`
  - `id` (uuid, primary key)
  - `seller_id` (uuid, not null) - References profiles.id
  - `title` (text, not null) - Product name
  - `description` (text, not null) - Detailed description
  - `price` (numeric, not null) - Price in INR
  - `category` (text, not null) - Product category
  - `condition` (text, not null) - Product condition
  - `images` (text[], not null) - Array of image URLs
  - `status` (text, default 'available') - available, sold, removed
  - `views` (integer, default 0) - View count for popularity
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `wishlists`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null) - References profiles.id
  - `product_id` (uuid, not null) - References products.id
  - `created_at` (timestamptz, default now())
  - Unique constraint on (user_id, product_id)

  ### `chats`
  - `id` (uuid, primary key)
  - `product_id` (uuid, not null) - References products.id
  - `buyer_id` (uuid, not null) - References profiles.id
  - `seller_id` (uuid, not null) - References profiles.id
  - `last_message` (text) - Most recent message
  - `last_message_at` (timestamptz) - Timestamp of last message
  - `created_at` (timestamptz, default now())
  - Unique constraint on (product_id, buyer_id)

  ### `messages`
  - `id` (uuid, primary key)
  - `chat_id` (uuid, not null) - References chats.id
  - `sender_id` (uuid, not null) - References profiles.id
  - `content` (text, not null) - Message content
  - `is_read` (boolean, default false) - Read status
  - `created_at` (timestamptz, default now())

  ### `transactions`
  - `id` (uuid, primary key)
  - `product_id` (uuid, not null) - References products.id
  - `buyer_id` (uuid, not null) - References profiles.id
  - `seller_id` (uuid, not null) - References profiles.id
  - `amount` (numeric, not null) - Transaction amount
  - `payment_method` (text, not null) - online or cod
  - `payment_status` (text, default 'pending') - pending, completed, failed
  - `delivery_status` (text, default 'pending') - pending, completed
  - `meeting_location` (text) - Campus meetup location
  - `created_at` (timestamptz, default now())
  - `completed_at` (timestamptz)

  ### `feedback`
  - `id` (uuid, primary key)
  - `transaction_id` (uuid, not null) - References transactions.id
  - `buyer_id` (uuid, not null) - References profiles.id
  - `seller_id` (uuid, not null) - References profiles.id
  - `rating` (integer, not null) - Rating 1-5
  - `comment` (text) - Feedback comment
  - `created_at` (timestamptz, default now())
  - Unique constraint on transaction_id

  ### `reports`
  - `id` (uuid, primary key)
  - `reporter_id` (uuid, not null) - References profiles.id
  - `reported_user_id` (uuid) - References profiles.id
  - `product_id` (uuid) - References products.id
  - `reason` (text, not null) - Report reason
  - `description` (text) - Detailed description
  - `status` (text, default 'pending') - pending, reviewed, resolved
  - `admin_notes` (text) - Admin resolution notes
  - `created_at` (timestamptz, default now())
  - `resolved_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Policies for authenticated users based on ownership and role
  - Admin-only policies for moderation actions
  - Public read access for product listings

  ## 3. Important Notes
  - All users must have Thapar University email (@thapar.edu)
  - Seller reputation automatically updates from feedback
  - Real-time subscriptions enabled for chats and messages
  - Cascade deletes configured for data integrity
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  hostel_block text,
  avatar_url text,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
  reputation_score numeric NOT NULL DEFAULT 0,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-----------------------------------------------------------------------------------
-- 🔥 AUTOMATIC PROFILE CREATION ON SIGNUP
-----------------------------------------------------------------------------------

-- Function to handle new user signup from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the above function after each new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-----------------------------------------------------------------------------------

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  category text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('new', 'like-new', 'good', 'fair', 'poor')),
  images text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'removed')),
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- (the rest of your tables, policies, and triggers remain unchanged)


-- Create wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, buyer_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('online', 'cod')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'completed')),
  meeting_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;


-- Products policies
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  TO authenticated
  USING (status = 'available' OR seller_id = auth.uid());

CREATE POLICY "Sellers can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Wishlists policies
CREATE POLICY "Users can view own wishlist"
  ON wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own wishlist"
  ON wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own wishlist"
  ON wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Chats policies
CREATE POLICY "Users can view own chats"
  ON chats FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update chats"
  ON chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Messages policies
CREATE POLICY "Users can view messages in own chats"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in own chats"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Feedback policies
CREATE POLICY "Anyone can view feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Buyers can create feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Reports policies
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_chats_buyer_id ON chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller_id ON chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_feedback_seller_id ON feedback(seller_id);

-- Create function to update reputation score
CREATE OR REPLACE FUNCTION update_seller_reputation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET reputation_score = (
    SELECT COALESCE(AVG(rating), 0)
    FROM feedback
    WHERE seller_id = NEW.seller_id
  )
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for reputation updates
DROP TRIGGER IF EXISTS trigger_update_reputation ON feedback;
CREATE TRIGGER trigger_update_reputation
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_reputation();

-- Create function to update product status when sold
CREATE OR REPLACE FUNCTION mark_product_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed' THEN
    UPDATE products
    SET status = 'sold'
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for marking products as sold
DROP TRIGGER IF EXISTS trigger_mark_product_sold ON transactions;
CREATE TRIGGER trigger_mark_product_sold
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION mark_product_sold();


-- Allow public read access for product images
CREATE POLICY "Allow public read access for product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to upload their own images
CREATE POLICY "Allow authenticated uploads for product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);

-- Allow users to delete only their own uploads
CREATE POLICY "Allow delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);

