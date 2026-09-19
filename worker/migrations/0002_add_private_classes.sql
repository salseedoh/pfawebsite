ALTER TABLE classes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));
ALTER TABLE classes ADD COLUMN private_access_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS classes_private_access_token_idx ON classes(private_access_token);
