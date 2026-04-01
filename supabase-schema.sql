-- Supabase SQL Schema for Nursing Pharmacology
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drugs table
CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  description TEXT,
  image TEXT DEFAULT '',
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Blocks table
CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drug_slug TEXT NOT NULL REFERENCES drugs(slug) ON DELETE CASCADE,
  block_order INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('content', 'mc', 'sata')),
  title TEXT NOT NULL,
  content TEXT,
  key_points TEXT,
  question TEXT,
  options TEXT,
  correct TEXT,
  explanation TEXT,
  rationale TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  user_email TEXT,
  target TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics - Page Views
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics - Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT,
  product_name TEXT,
  amount INTEGER,
  status TEXT DEFAULT 'pending',
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_drugs_slug ON drugs(slug);
CREATE INDEX IF NOT EXISTS idx_content_blocks_drug ON content_blocks(drug_slug);
CREATE INDEX IF NOT EXISTS idx_content_blocks_order ON content_blocks(drug_slug, block_order);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON page_views(timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON drugs FOR SELECT USING (true);
CREATE POLICY "Allow public read blocks" ON content_blocks FOR SELECT USING (true);

-- Admin can do everything
CREATE POLICY "Admin full access drugs" ON drugs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE email = current_user AND is_admin = true)
);
CREATE POLICY "Admin full access blocks" ON content_blocks FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE email = current_user AND is_admin = true)
);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drugs_updated_at BEFORE UPDATE ON drugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert initial admin user (change password after login)
-- Password: admin123 (hashed)
INSERT INTO users (email, password, tier, is_admin) VALUES (
  'admin@nursingpharmacology.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1d9z7yCJ8q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q',
  'premium',
  true
) ON CONFLICT (email) DO NOTHING;
