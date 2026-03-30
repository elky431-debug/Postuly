-- À exécuter dans Supabase si le schéma principal a été appliqué avant l’ajout de gmail_tokens.

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

ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can insert own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can update own gmail tokens" ON gmail_tokens;
DROP POLICY IF EXISTS "Users can delete own gmail tokens" ON gmail_tokens;

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

CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON gmail_tokens(user_id);
