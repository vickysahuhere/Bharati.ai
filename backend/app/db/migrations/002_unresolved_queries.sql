CREATE TABLE IF NOT EXISTS unresolved_queries (
  id bigserial PRIMARY KEY,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unresolved_queries_created_at_idx ON unresolved_queries (created_at DESC);
