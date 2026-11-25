-- Read-only history queries use the episode's existing patient_id.
-- This additive index changes no patient, episode, identity or clinical record.
CREATE INDEX IF NOT EXISTS idx_episodes_patient_history
ON episodes (patient_id, started_at DESC, id DESC);
