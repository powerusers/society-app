-- Amenities, the classes that run in them, and the bookings residents make.
--
-- This is the part of the app where two residents can genuinely collide: the
-- browser-local version checked for a clash against the bookings in *its own*
-- storage, so two households could book the clubhouse for the same Saturday
-- evening and each would be told the slot was theirs.

CREATE TABLE amenities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  emoji       text NOT NULL DEFAULT '🏛️',
  capacity    integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  charge      integer NOT NULL DEFAULT 0 CHECK (charge >= 0),
  deposit     integer NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  -- The bookable slots, in the society's own words ("19:00–23:00"). Free text
  -- rather than times, because a society that lets the lawn from dawn to dusk
  -- should be able to say so without the schema arguing.
  slots       text[] NOT NULL DEFAULT '{}',
  rules       text NOT NULL DEFAULT '',
  -- Whether a booking waits for the committee. A property of the amenity, so
  -- the server decides rather than the client inferring it from the amount —
  -- which is what the browser version did, and could therefore be edited.
  requires_approval boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, name)
);

CREATE TABLE amenity_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id   uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  amenity_id   uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  flat_id      uuid REFERENCES flats(id) ON DELETE SET NULL,
  booking_date date NOT NULL,
  slot         text NOT NULL,
  guests       integer NOT NULL DEFAULT 1 CHECK (guests > 0),
  note         text NOT NULL DEFAULT '',
  amount       integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status       text NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('pending','confirmed','cancelled')),
  reason       text NOT NULL DEFAULT '',
  decided_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The double-booking rule, enforced where it cannot be raced. Two residents
-- tapping "Book" on the same slot in the same second both pass any check the
-- API could write; one of them loses here, and is told so.
-- A cancelled booking frees the slot, hence the partial index.
CREATE UNIQUE INDEX amenity_slot_once
  ON amenity_bookings (amenity_id, booking_date, slot)
  WHERE status <> 'cancelled';

CREATE INDEX amenity_bookings_diary_idx ON amenity_bookings (society_id, booking_date);
CREATE INDEX amenity_bookings_mine_idx ON amenity_bookings (user_id, booking_date DESC);

CREATE TABLE amenity_classes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  amenity_id uuid REFERENCES amenities(id) ON DELETE SET NULL,
  name       text NOT NULL,
  emoji      text NOT NULL DEFAULT '🧘',
  trainer    text NOT NULL DEFAULT '',
  days       text NOT NULL DEFAULT '',
  time       text NOT NULL DEFAULT '',
  fee        integer NOT NULL DEFAULT 0 CHECK (fee >= 0),
  seats      integer NOT NULL DEFAULT 10 CHECK (seats > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enrolment is a person, not a counter. The browser version incremented a
-- number, so tapping "Enrol" five times filled five seats with one resident.
CREATE TABLE class_enrolments (
  class_id    uuid NOT NULL REFERENCES amenity_classes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Past the last seat you are on the waitlist, in the order people asked.
  waitlisted  boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
