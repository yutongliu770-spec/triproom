CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  rough_destination TEXT,
  trip_duration_days INTEGER,
  rough_date_text TEXT,
  current_focus_node_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE trip_members (
  trip_id TEXT NOT NULL REFERENCES trips(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL,
  join_status TEXT NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, member_id)
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  author_type TEXT NOT NULL,
  author_member_id TEXT REFERENCES members(id),
  message_type TEXT NOT NULL,
  text_content TEXT,
  payload JSONB,
  visibility TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE destination_nodes (
  id TEXT PRIMARY KEY,
  provider TEXT DEFAULT 'seed',
  provider_place_id TEXT,
  canonical_name TEXT NOT NULL,
  aliases JSONB NOT NULL,
  node_type TEXT NOT NULL,
  parent_id TEXT,
  country_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  short_summary TEXT NOT NULL,
  long_description TEXT,
  highlights JSONB NOT NULL,
  tags JSONB NOT NULL,
  suggested_stay_text TEXT,
  budget_band TEXT,
  hero_image_url TEXT,
  images JSONB,
  image_alt TEXT NOT NULL,
  data_source TEXT,
  data_freshness TEXT,
  data_as_of TEXT,
  last_synced_at TEXT,
  popularity_score DOUBLE PRECISION,
  social_discovery JSONB,
  is_seed_data BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  created_by_type TEXT NOT NULL,
  created_by_member_id TEXT,
  material_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_provider TEXT,
  source_url TEXT,
  raw_text TEXT,
  attachment_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  primary_node_id TEXT,
  extraction_status TEXT NOT NULL,
  extraction_confidence DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE room_node_states (
  trip_id TEXT NOT NULL REFERENCES trips(id),
  node_id TEXT NOT NULL REFERENCES destination_nodes(id),
  state TEXT NOT NULL,
  exploration_state TEXT,
  engagement_score DOUBLE PRECISION,
  interest_score DOUBLE PRECISION,
  disagreement_score DOUBLE PRECISION,
  first_discovered_at TIMESTAMP,
  last_interacted_at TIMESTAMP,
  mention_count INTEGER NOT NULL DEFAULT 0,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  shown_count INTEGER NOT NULL DEFAULT 0,
  last_shown_at TIMESTAMP,
  aggregate_signal JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, node_id)
);

CREATE TABLE member_signals (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  polarity INTEGER NOT NULL,
  intensity INTEGER NOT NULL,
  reason TEXT,
  visibility TEXT NOT NULL,
  scope TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE plan_variants (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  total_days INTEGER,
  segments JSONB NOT NULL,
  included_node_ids JSONB NOT NULL,
  excluded_highlights JSONB NOT NULL,
  mobility_text TEXT NOT NULL,
  budget_text TEXT NOT NULL,
  budget_is_estimate BOOLEAN NOT NULL,
  gains JSONB NOT NULL,
  tradeoffs JSONB NOT NULL,
  based_on_signal_ids JSONB NOT NULL,
  unresolved_questions JSONB NOT NULL,
  parent_plan_id TEXT,
  change_summary JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
