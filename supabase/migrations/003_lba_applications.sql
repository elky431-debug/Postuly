-- Migration 003 : candidatures La Bonne Alternance
-- Stocke chaque candidature envoyée via l'API LBA
-- UNIQUE(user_id, job_id, job_type) pour bloquer les doublons

CREATE TABLE IF NOT EXISTS lba_applications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id       TEXT        NOT NULL,
  job_type     TEXT        NOT NULL CHECK (job_type IN ('recruteur_lba', 'offre_lba', 'offre_partenaire')),
  siret        TEXT,
  company_name TEXT        NOT NULL,
  rome_code    TEXT,
  city         TEXT,
  status       TEXT        NOT NULL DEFAULT 'envoyee',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, job_id, job_type)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_lba_applications_user_id  ON lba_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_lba_applications_siret    ON lba_applications (siret);
CREATE INDEX IF NOT EXISTS idx_lba_applications_sent_at  ON lba_applications (sent_at DESC);

-- RLS : chaque utilisateur voit uniquement ses propres candidatures
ALTER TABLE lba_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lba_applications_own" ON lba_applications
  FOR ALL USING (auth.uid() = user_id);
