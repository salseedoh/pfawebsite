ALTER TABLE classes ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0 CHECK (is_virtual IN (0, 1));
ALTER TABLE classes ADD COLUMN virtual_room_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS classes_virtual_room_name_idx ON classes(virtual_room_name) WHERE virtual_room_name IS NOT NULL;

ALTER TABLE registrations ADD COLUMN virtual_join_token_hash TEXT;
ALTER TABLE registrations ADD COLUMN virtual_join_token_issued_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_virtual_join_token_hash_idx ON registrations(virtual_join_token_hash) WHERE virtual_join_token_hash IS NOT NULL;
