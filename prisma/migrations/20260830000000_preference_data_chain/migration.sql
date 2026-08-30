-- Preference data chain: Evidence -> Signal -> Constraint -> MemberPlaceProfile -> RoomPlaceProfile.
-- PlanningContextSnapshot is stored for future planner input snapshots, but this migration does not
-- implement TravelPlanningAgent behavior.

CREATE TABLE evidences (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  member_id TEXT REFERENCES members(id),
  target_type TEXT NOT NULL,
  target_id TEXT,
  evidence_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT,
  source_message_id TEXT,
  source_material_id TEXT,
  source_place_opinion_id TEXT,
  raw_text_snapshot TEXT,
  raw_payload JSONB,
  metadata JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  analysis_error TEXT,
  visibility TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP
);

CREATE INDEX evidences_trip_id_analysis_status_idx ON evidences(trip_id, analysis_status);
CREATE INDEX evidences_trip_id_target_type_target_id_idx ON evidences(trip_id, target_type, target_id);
CREATE INDEX evidences_source_entity_type_source_entity_id_idx ON evidences(source_entity_type, source_entity_id);

ALTER TABLE member_signals
  ADD COLUMN evidence_id TEXT REFERENCES evidences(id),
  ADD COLUMN aspect TEXT,
  ADD COLUMN intent TEXT,
  ADD COLUMN condition_text TEXT,
  ADD COLUMN constraint_candidate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN extracted_attributes JSONB,
  ADD COLUMN source_message_id TEXT,
  ADD COLUMN source_material_id TEXT,
  ADD COLUMN source_place_opinion_id TEXT,
  ADD COLUMN created_by TEXT NOT NULL DEFAULT 'user_action',
  ADD COLUMN model_name TEXT,
  ADD COLUMN model_version TEXT,
  ADD COLUMN extraction_run_id TEXT,
  ADD COLUMN invalidated_at TIMESTAMP;

CREATE INDEX member_signals_evidence_id_idx ON member_signals(evidence_id);
CREATE INDEX member_signals_trip_id_member_id_target_type_target_id_idx ON member_signals(trip_id, member_id, target_type, target_id);
CREATE INDEX member_signals_trip_id_target_type_target_id_idx ON member_signals(trip_id, target_type, target_id);

CREATE TABLE place_opinions (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  node_id TEXT NOT NULL REFERENCES destination_nodes(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  source_type TEXT NOT NULL,
  source_message_id TEXT,
  source_evidence_id TEXT,
  content TEXT NOT NULL,
  reaction TEXT NOT NULL,
  visibility TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX place_opinions_trip_id_node_id_idx ON place_opinions(trip_id, node_id);
CREATE INDEX place_opinions_trip_id_member_id_node_id_idx ON place_opinions(trip_id, member_id, node_id);

CREATE TABLE member_constraints (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  member_id TEXT REFERENCES members(id),
  target_type TEXT,
  target_id TEXT,
  source_kind TEXT NOT NULL,
  constraint_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  polarity INTEGER,
  priority_score DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  summary TEXT NOT NULL,
  condition_text TEXT,
  structured_value JSONB,
  evidence_ids JSONB,
  signal_ids JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  model_name TEXT,
  model_version TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMP
);

CREATE INDEX member_constraints_trip_id_member_id_status_idx ON member_constraints(trip_id, member_id, status);
CREATE INDEX member_constraints_trip_id_target_type_target_id_idx ON member_constraints(trip_id, target_type, target_id);

CREATE TABLE member_place_profiles (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  node_id TEXT NOT NULL REFERENCES destination_nodes(id),
  interest_score DOUBLE PRECISION NOT NULL,
  positive_score DOUBLE PRECISION,
  negative_score DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION NOT NULL,
  stance TEXT NOT NULL,
  summary TEXT NOT NULL,
  positive_reasons JSONB NOT NULL,
  negative_reasons JSONB NOT NULL,
  condition_text TEXT,
  constraint_summary TEXT,
  must_go BOOLEAN NOT NULL DEFAULT false,
  hard_reject BOOLEAN NOT NULL DEFAULT false,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  constraint_ids JSONB,
  top_signal_ids JSONB NOT NULL,
  source_evidence_ids JSONB NOT NULL,
  last_signal_at TIMESTAMP,
  aggregation_version TEXT NOT NULL,
  last_calculated_at TIMESTAMP NOT NULL DEFAULT now(),
  stale_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT member_place_profiles_trip_id_member_id_node_id_key UNIQUE (trip_id, member_id, node_id)
);

CREATE INDEX member_place_profiles_trip_id_node_id_idx ON member_place_profiles(trip_id, node_id);

CREATE TABLE room_place_profiles (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  node_id TEXT NOT NULL REFERENCES destination_nodes(id),
  team_interest_score DOUBLE PRECISION NOT NULL,
  engagement_score DOUBLE PRECISION NOT NULL,
  disagreement_score DOUBLE PRECISION NOT NULL,
  member_stances JSONB NOT NULL,
  summary TEXT NOT NULL,
  common_positive_reasons JSONB NOT NULL,
  main_concerns JSONB NOT NULL,
  conditional_fit_notes JSONB,
  unresolved_questions JSONB,
  must_go_member_ids JSONB,
  hard_reject_member_ids JSONB,
  member_profile_ids JSONB NOT NULL,
  source_evidence_ids JSONB NOT NULL,
  top_signal_ids JSONB NOT NULL,
  constraint_ids JSONB,
  aggregation_version TEXT NOT NULL,
  last_calculated_at TIMESTAMP NOT NULL DEFAULT now(),
  stale_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT room_place_profiles_trip_id_node_id_key UNIQUE (trip_id, node_id)
);

CREATE TABLE planning_context_snapshots (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  created_by_member_id TEXT,
  trigger_type TEXT NOT NULL,
  trip_snapshot JSONB NOT NULL,
  members_snapshot JSONB NOT NULL,
  destination_nodes_snapshot JSONB NOT NULL,
  destination_relations_snapshot JSONB NOT NULL,
  room_place_profiles_snapshot JSONB NOT NULL,
  member_place_profiles_snapshot JSONB NOT NULL,
  constraints_snapshot JSONB NOT NULL,
  key_evidence_refs JSONB NOT NULL,
  key_signal_refs JSONB NOT NULL,
  provider_context_snapshot JSONB,
  model_name TEXT,
  model_version TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX planning_context_snapshots_trip_id_created_at_idx ON planning_context_snapshots(trip_id, created_at);
