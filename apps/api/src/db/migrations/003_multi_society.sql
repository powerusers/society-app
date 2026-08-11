-- One deployment now hosts many societies, so the entry points have to stop
-- assuming there is only ever one.

-- Email identified a person *within* a society, which is the right constraint
-- for a single-society install and the wrong one for a platform: two societies
-- could each hold an account for the same address, and sign-in looks a user up
-- by email alone. It would have matched whichever row Postgres returned first,
-- silently signing someone into a society they do not belong to.
--
-- Making it global keeps sign-in a single field, which is what a mobile app
-- needs. The cost is that one person cannot hold accounts at two societies on
-- the same address; that needs users to belong to many societies, which is a
-- larger change than this one.
ALTER TABLE users DROP CONSTRAINT users_society_id_email_key;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

-- A pending application is a claim on an email that does not exist yet, so the
-- same address must not be able to queue at two societies at once and then fail
-- on approval at whichever one decides second.
CREATE UNIQUE INDEX registrations_pending_email_idx
  ON registrations (email) WHERE status = 'pending';

-- The picker lists societies by name, and onboarding must not create two that
-- residents cannot tell apart.
CREATE UNIQUE INDEX societies_name_key ON societies (lower(name));
