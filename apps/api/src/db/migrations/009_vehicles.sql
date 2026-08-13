-- Registered vehicles and the parking slots they sit in.
--
-- A parking slot is the second thing in this app two residents can collide
-- over: P1-42 belongs to exactly one car, and two flats each believing it is
-- theirs is a dispute the committee ends up refereeing in person.

CREATE TABLE vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id     uuid REFERENCES flats(id) ON DELETE SET NULL,
  owner_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  kind        text NOT NULL DEFAULT 'Car' CHECK (kind IN ('Car','Bike','EV')),
  model       text NOT NULL,
  -- Stored normalised (upper case, no spaces or dashes) so "MH12AB1234" and
  -- "MH-12-AB-1234" are the same plate to the uniqueness check and to the gate.
  number      text NOT NULL,
  slot        text NOT NULL DEFAULT '',
  -- Sequential within the society, which is what a physical sticker on a
  -- windscreen actually is.
  sticker_no  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One registration per plate. A car registered against two flats is either a
  -- typo or a dispute; both want catching at the point of entry.
  UNIQUE (society_id, number),
  UNIQUE (society_id, sticker_no)
);

-- One car per slot. Vehicles with no allotted slot are exempt, which is why
-- this is partial rather than a plain unique constraint.
CREATE UNIQUE INDEX vehicle_slot_once
  ON vehicles (society_id, slot)
  WHERE slot <> '';

CREATE INDEX vehicles_flat_idx ON vehicles (society_id, flat_id);
