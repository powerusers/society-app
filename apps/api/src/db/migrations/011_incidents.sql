-- The incident register was in the schema from the start and never used: no
-- route wrote to it, so the guard's records lived on the guard's device. This
-- finishes the table so the register can be what it claims to be — evidence for
-- the committee, protection for the guard.
--
-- The table is empty in every deployment (nothing has ever inserted into it),
-- so these constraints are added plainly rather than NOT VALID.

-- The types the app actually offers. Without this the column accepted anything
-- and the register could not be counted by category.
ALTER TABLE incidents
  ADD CONSTRAINT incidents_type_check
  CHECK (type IN ('misbehaviour','trespass','safety','vehicle','overstay','other'));

ALTER TABLE incidents
  ALTER COLUMN severity SET DEFAULT 'medium';

-- Closing one is a review, so it records who reviewed it and what they
-- concluded. The guard who wrote the incident is not the person who signs it
-- off, and "closed" with nobody's name against it says nothing.
ALTER TABLE incidents
  ADD COLUMN closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN closing_note text NOT NULL DEFAULT '';

-- Closed and having a closing time are one fact, not two that can disagree.
ALTER TABLE incidents
  ADD CONSTRAINT incidents_closed_has_time
  CHECK ((status = 'closed') = (closed_at IS NOT NULL));

-- The register is read newest-first, filtered by status.
CREATE INDEX incidents_register_idx ON incidents (society_id, status, created_at DESC);
