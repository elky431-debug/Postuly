-- ============================================
-- Postuly — Schéma de base de données
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profils utilisateurs (étend auth.users de Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  profile_type TEXT CHECK (profile_type IN ('etudiant', 'jeune_actif')),
  cv_url TEXT,
  cv_parsed JSONB,
  cv_score INTEGER,
  gmail_token JSONB,
  outlook_token JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer automatiquement un profil quand un user s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Campagnes de candidature
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  location TEXT NOT NULL,
  radius_km INTEGER DEFAULT 30,
  contract_type TEXT CHECK (contract_type IN ('stage', 'alternance', 'cdi', 'cdd')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entreprises (cache local des résultats SIRENE)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siret TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  naf_code TEXT,
  naf_label TEXT,
  size_range TEXT,
  website_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts email RH (résultat du scraping)
CREATE TABLE IF NOT EXISTS email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  source TEXT CHECK (source IN ('scraped', 'guessed', 'manual')),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidatures
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE SET NULL,
  cover_letter TEXT,
  status TEXT DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'sent', 'followed_up',
    'replied', 'interview', 'offer', 'rejected'
  )),
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT,
  body TEXT,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens Gmail (chiffrés côté app — AES-256-GCM avant insertion)
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_email TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Permet de relancer tout le script sans erreur 42710 (policy already exists)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can view own applications" ON applications;
DROP POLICY IF EXISTS "Users can update own applications" ON applications;
DROP POLICY IF EXISTS "Users can view own email logs" ON email_logs;
DROP POLICY IF EXISTS "Anyone can read companies" ON companies;
DROP POLICY IF EXISTS "Anyone can read email contacts" ON email_contacts;
DROP POLICY IF EXISTS "Users can view own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can insert own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can update own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can delete own gmail tokens" ON gmail_tokens;

-- Profiles : un user ne voit que son propre profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Campaigns : un user ne voit que ses campagnes
CREATE POLICY "Users can view own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Applications : via la campagne de l'utilisateur
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own applications"
  ON applications FOR UPDATE
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

-- Email logs : via l'application de l'utilisateur
CREATE POLICY "Users can view own email logs"
  ON email_logs FOR SELECT
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN campaigns c ON a.campaign_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Companies et email_contacts sont publics en lecture (cache partagé)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read companies"
  ON companies FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read email contacts"
  ON email_contacts FOR SELECT
  USING (true);

-- Gmail : uniquement le propriétaire (les appels n8n passent par la service role, hors RLS)
CREATE POLICY "Users can view own gmail tokens"
  ON gmail_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail tokens"
  ON gmail_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail tokens"
  ON gmail_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail tokens"
  ON gmail_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_campaign_id ON applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_companies_siret ON companies(siret);
CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(city);
CREATE INDEX IF NOT EXISTS idx_email_contacts_company_id ON email_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON gmail_tokens(user_id);
