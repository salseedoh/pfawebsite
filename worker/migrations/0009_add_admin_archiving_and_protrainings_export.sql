ALTER TABLE classes ADD COLUMN admin_archived_at TEXT;

ALTER TABLE registrations ADD COLUMN admin_archived_at TEXT;
ALTER TABLE registrations ADD COLUMN protrainings_exported_at TEXT;

ALTER TABLE kit_orders ADD COLUMN admin_archived_at TEXT;

CREATE INDEX IF NOT EXISTS registrations_protrainings_exported_at_idx
  ON registrations(protrainings_exported_at);
