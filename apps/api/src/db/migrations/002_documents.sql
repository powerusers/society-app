-- Document vault. Bytes live in S3; this table holds the metadata and the key.

CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL,
  -- 'residents' is visible to everyone in the society; 'committee' is not
  visibility    text NOT NULL DEFAULT 'residents' CHECK (visibility IN ('residents','committee')),
  -- object key in the bucket, generated server-side and never client-supplied
  storage_key   text NOT NULL UNIQUE,
  content_type  text NOT NULL,
  size_bytes    bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  -- 'pending' until the upload is confirmed present in the bucket; lists only show 'ready'
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX documents_society_idx ON documents (society_id, status, category);
-- lets a sweep find uploads that were started and abandoned
CREATE INDEX documents_pending_idx ON documents (status, created_at) WHERE status = 'pending';
