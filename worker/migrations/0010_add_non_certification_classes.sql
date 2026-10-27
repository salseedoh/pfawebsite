ALTER TABLE classes ADD COLUMN is_non_certification INTEGER NOT NULL DEFAULT 0
  CHECK (is_non_certification IN (0, 1));
