-- Enrichissement des contacts (Hunter / scraping) + flag sélection entreprise.
-- À exécuter dans le SQL Editor Supabase si le schéma principal est déjà en place.

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 0;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT false;

COMMENT ON COLUMN email_contacts.name IS 'Nom affiché du contact (prénom + nom)';
COMMENT ON COLUMN email_contacts.role IS 'Intitulé de poste / fonction';
COMMENT ON COLUMN email_contacts.department IS 'Service ou pôle (ex. RH, IT)';
COMMENT ON COLUMN email_contacts.confidence IS 'Score 0–100 (ex. Hunter)';
COMMENT ON COLUMN companies.selected IS 'Marquée comme sélectionnée pour le flux campagne (usage produit ; multi-utilisateurs : prévoir table de liaison si besoin)';
