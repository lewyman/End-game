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

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT DEFAULT 'NursingPharmacology',
  drug_name TEXT NOT NULL,
  drug_class TEXT DEFAULT '',
  description TEXT DEFAULT '',
  lyrics TEXT DEFAULT '',
  audio_path TEXT NOT NULL,
  cover_path TEXT DEFAULT '',
  duration_seconds INTEGER DEFAULT 180,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  genre TEXT DEFAULT 'country pop',
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- =============================================
-- FEATURE TABLES (Playlists, Favorites, etc.)
-- =============================================

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_path TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playlist songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- Favorites (liked songs)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- Recently played
CREATE TABLE IF NOT EXISTS recently_played (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_songs_drug_name ON songs(drug_name);
CREATE INDEX IF NOT EXISTS idx_songs_slug ON songs(slug);

-- Feature table indexes
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_song ON favorites(song_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_song ON recently_played(song_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_time ON recently_played(played_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_played ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON drugs FOR SELECT USING (true);
CREATE POLICY "Allow public read blocks" ON content_blocks FOR SELECT USING (true);
CREATE POLICY "Allow public read songs" ON songs FOR SELECT USING (true);
CREATE POLICY "Allow public read playlists" ON playlists FOR SELECT USING (true);
CREATE POLICY "Allow public read playlist songs" ON playlist_songs FOR SELECT USING (true);
CREATE POLICY "Allow public read favorites" ON favorites FOR SELECT USING (true);
CREATE POLICY "Allow public read recently played" ON recently_played FOR SELECT USING (true);

-- Admin can do everything
CREATE POLICY "Admin full access drugs" ON drugs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE email = current_user AND is_admin = true)
);
CREATE POLICY "Admin full access blocks" ON content_blocks FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE email = current_user AND is_admin = true)
);
CREATE POLICY "Admin full access songs" ON songs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE email = current_user AND is_admin = true)
);

-- Users manage own data
CREATE POLICY "Users manage own playlists" ON playlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own playlist_songs" ON playlist_songs FOR ALL USING (
  EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND user_id = auth.uid())
);
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own recently_played" ON recently_played FOR ALL USING (auth.uid() = user_id);

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
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1d9z7yCJ8q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q',
  'premium',
  true
) ON CONFLICT (email) DO NOTHING;