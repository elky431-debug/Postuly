-- ============================================
-- Postuly — Bucket Supabase Storage pour les CV
-- À exécuter dans Supabase → SQL Editor (une fois par projet)
-- ============================================
--
-- Sans le bucket « cvs », l’API d’upload ne peut pas enregistrer cv_url (reste NULL).
-- public = true : l’URL dans profiles.cv_url est téléchargeable (mails, navigateur).

INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Accès lecture pour les URLs publiques / fetch HTTP (pièce jointe Gmail, etc.)
DROP POLICY IF EXISTS "Lecture publique bucket cvs" ON storage.objects;
CREATE POLICY "Lecture publique bucket cvs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cvs');
