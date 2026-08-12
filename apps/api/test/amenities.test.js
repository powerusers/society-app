/**
 * Amenities, bookings and classes.
 *
 * This is the one part of the app where two residents can genuinely collide.
 * The browser version checked for a clash against the bookings in its own
 * storage, so two households could take the clubhouse for the same Saturday
 * evening and each be told the slot was theirs. Most of what follows is about
 * that not being possible any more, including when the two requests arrive at
 * the same instant.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, call, get, post, del, login, ACCOUNTS } from "./helpers.js";

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

describe("amenities", () => {
  let secretary, resident, other, guard;
  let hall, pool, court;

  const amenities = async (token) => (await get("/api/amenities", token)).body.amenities;
  const bookings = async (token) => (await get("/api/amenities/bookings", token)).body.bookings;
  const classes = async (token) => (await get("/api/amenities/classes", token)).body.classes;

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    guard = await login(ACCOUNTS.guard);

    const list = await amenities(resident.accessToken);
    hall = list.find((a) => a.name === "Clubhouse Hall");
    pool = list.find((a) => a.name === "Swimming Pool");
    court = list.find((a) => a.name === "Badminton Court");
    assert.ok(hall && pool && court, "the seeded society has amenities to book");
  });

  after(stopTestServer);

  describe("setting them up", () => {
    test("a resident cannot add one", async () => {
      const { status } = await post("/api/amenities", { name: "My private terrace", slots: ["all day"] }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("the committee can, and it appears for everyone", async () => {
      const created = await post("/api/amenities", {
        name: "Squash Court", emoji: "🎾", capacity: 2, charge: 200, slots: ["07:00–08:00", "18:00–19:00"],
      }, secretary.accessToken);
      assert.equal(created.status, 201);
      const seen = (await amenities(other.accessToken)).find((a) => a.name === "Squash Court");
      assert.ok(seen, "on another resident's list");
      assert.deepEqual(seen.slots, ["07:00–08:00", "18:00–19:00"]);
    });

    test("an amenity with no slots is refused — nothing could be booked on it", async () => {
      const { status } = await post("/api/amenities", { name: "Rooftop", slots: [] }, secretary.accessToken);
      assert.equal(status, 422);
    });

    test("retiring one hides it without destroying its bookings", async () => {
      const created = await post("/api/amenities", { name: "Old Gym", slots: ["06:00–07:00"] }, secretary.accessToken);
      const id = created.body.amenity.id;
      const booked = await post("/api/amenities/bookings", { amenityId: id, date: day(2), slot: "06:00–07:00" }, resident.accessToken);
      assert.equal(booked.status, 201);

      assert.equal((await del(`/api/amenities/${id}`, secretary.accessToken)).status, 204);
      assert.equal((await amenities(resident.accessToken)).find((a) => a.id === id), undefined, "gone from the list");
      assert.ok((await bookings(resident.accessToken)).find((b) => b.id === booked.body.booking.id),
        "but the resident's evening is still in the diary");
    });
  });

  describe("booking a slot", () => {
    test("a free amenity confirms straight away", async () => {
      const { status, body } = await post("/api/amenities/bookings",
        { amenityId: pool.id, date: day(3), slot: "06:00–08:00", guests: 2 }, resident.accessToken);
      assert.equal(status, 201);
      assert.equal(body.booking.status, "confirmed");
      assert.equal(body.booking.amount, 0);
    });

    test("one the committee vets waits for them", async () => {
      const { body } = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(9), slot: "09:00–13:00", guests: 40, note: "Naming ceremony" }, resident.accessToken);
      assert.equal(body.booking.status, "pending", "decided by the amenity, not by the amount the client sent");
      assert.equal(body.booking.amount, 2500, "and the charge comes from the register, not the request");
    });

    test("the same slot cannot be taken twice", async () => {
      const first = await post("/api/amenities/bookings", { amenityId: court.id, date: day(5), slot: "18:00–19:00" }, resident.accessToken);
      assert.equal(first.status, 201);
      const second = await post("/api/amenities/bookings", { amenityId: court.id, date: day(5), slot: "18:00–19:00" }, other.accessToken);
      assert.equal(second.status, 409);
      assert.match(second.body.error.message, /just been booked/);
    });

    test("even when both requests arrive at once", async () => {
      /* The check-then-insert an API can write is racy by construction; this is
         the case that proves the unique index is what actually decides. */
      const results = await Promise.all([
        post("/api/amenities/bookings", { amenityId: court.id, date: day(6), slot: "07:00–08:00" }, resident.accessToken),
        post("/api/amenities/bookings", { amenityId: court.id, date: day(6), slot: "07:00–08:00" }, other.accessToken),
      ]);
      const codes = results.map((r) => r.status).sort();
      assert.deepEqual(codes, [201, 409], "exactly one of them got the court");
    });

    test("a pending request holds the slot while it waits", async () => {
      const { status } = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(9), slot: "09:00–13:00" }, other.accessToken);
      assert.equal(status, 409, "otherwise the committee approves two parties for one evening");
    });

    test("a slot the amenity does not have is refused", async () => {
      const { status } = await post("/api/amenities/bookings",
        { amenityId: pool.id, date: day(3), slot: "23:00–01:00" }, resident.accessToken);
      assert.equal(status, 422);
    });

    test("more guests than the place holds is refused", async () => {
      const { status, body } = await post("/api/amenities/bookings",
        { amenityId: court.id, date: day(7), slot: "06:00–07:00", guests: 40 }, resident.accessToken);
      assert.equal(status, 422);
      assert.match(body.error.message, /holds 4 people/);
    });

    test("a date that has passed is refused", async () => {
      const { status } = await post("/api/amenities/bookings",
        { amenityId: pool.id, date: day(-2), slot: "08:00–10:00" }, resident.accessToken);
      assert.equal(status, 422);
    });

    test("a guard on the register may book too", async () => {
      const { status } = await post("/api/amenities/bookings",
        { amenityId: pool.id, date: day(4), slot: "17:00–19:00" }, guard.accessToken);
      assert.equal(status, 201, "staff live here too, or at least swim here");
    });
  });

  describe("the diary", () => {
    test("is shared — a neighbour can see the slot is taken", async () => {
      const mine = (await bookings(other.accessToken)).filter((b) => b.amenityId === court.id && b.date === day(5));
      assert.equal(mine.length, 1);
      assert.equal(mine[0].mine, false);
      assert.ok(mine[0].flatCode, "with the flat, which is what a shared diary is for");
    });

    test("but the note to the committee is not everyone's business", async () => {
      const seen = (await bookings(other.accessToken)).find((b) => b.note === "Naming ceremony");
      assert.equal(seen, undefined, "a neighbour cannot read why the hall was booked");
      const own = (await bookings(resident.accessToken)).find((b) => b.slot === "09:00–13:00" && b.date === day(9));
      assert.equal(own.note, "Naming ceremony", "the resident who wrote it still sees it");
      const committee = (await bookings(secretary.accessToken)).find((b) => b.slot === "09:00–13:00" && b.date === day(9));
      assert.equal(committee.note, "Naming ceremony", "and so does the committee it was written to");
    });
  });

  describe("deciding a request", () => {
    let request;

    before(async () => {
      const { body } = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(12), slot: "14:00–18:00", guests: 30 }, resident.accessToken);
      request = body.booking;
    });

    test("a resident cannot approve their own", async () => {
      const { status } = await post(`/api/amenities/bookings/${request.id}/decide`, { decision: "confirmed" }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("the committee can, and the resident sees it", async () => {
      const { status } = await post(`/api/amenities/bookings/${request.id}/decide`, { decision: "confirmed" }, secretary.accessToken);
      assert.equal(status, 200);
      const seen = (await bookings(resident.accessToken)).find((b) => b.id === request.id);
      assert.equal(seen.status, "confirmed");
    });

    test("and cannot decide it twice", async () => {
      const { status } = await post(`/api/amenities/bookings/${request.id}/decide`, { decision: "cancelled" }, secretary.accessToken);
      assert.equal(status, 409);
    });

    test("refusing one frees the slot for somebody else", async () => {
      const asked = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(14), slot: "19:00–23:00" }, resident.accessToken);
      const blocked = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(14), slot: "19:00–23:00" }, other.accessToken);
      assert.equal(blocked.status, 409);

      await post(`/api/amenities/bookings/${asked.body.booking.id}/decide`,
        { decision: "cancelled", reason: "Lawn already booked for the same evening" }, secretary.accessToken);

      const retry = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(14), slot: "19:00–23:00" }, other.accessToken);
      assert.equal(retry.status, 201, "the evening is available again");
    });
  });

  describe("cancelling", () => {
    test("a neighbour cannot cancel your booking", async () => {
      const mine = (await bookings(resident.accessToken)).find((b) => b.mine && b.status === "confirmed");
      assert.equal((await del(`/api/amenities/bookings/${mine.id}`, other.accessToken)).status, 403);
    });

    test("you can cancel your own, and the slot comes free", async () => {
      const booked = await post("/api/amenities/bookings", { amenityId: court.id, date: day(8), slot: "20:00–21:00" }, resident.accessToken);
      assert.equal((await del(`/api/amenities/bookings/${booked.body.booking.id}`, resident.accessToken)).status, 204);
      const retry = await post("/api/amenities/bookings", { amenityId: court.id, date: day(8), slot: "20:00–21:00" }, other.accessToken);
      assert.equal(retry.status, 201);
    });

    test("the committee can cancel anyone's", async () => {
      const booked = await post("/api/amenities/bookings", { amenityId: pool.id, date: day(10), slot: "19:00–21:00" }, other.accessToken);
      assert.equal((await del(`/api/amenities/bookings/${booked.body.booking.id}`, secretary.accessToken)).status, 204);
    });
  });

  describe("classes", () => {
    let yoga, swimming;

    before(async () => {
      const list = await classes(resident.accessToken);
      yoga = list.find((c) => c.name.startsWith("Yoga"));
      swimming = list.find((c) => c.name === "Swimming coaching");
    });

    test("enrolling takes a seat", async () => {
      const { status, body } = await post(`/api/amenities/classes/${yoga.id}/enrol`, {}, resident.accessToken);
      assert.equal(status, 201);
      assert.equal(body.class.mine, "enrolled");
      assert.equal(body.class.enrolled, 1);
    });

    test("enrolling five times does not take five seats", async () => {
      for (let i = 0; i < 4; i++) await post(`/api/amenities/classes/${yoga.id}/enrol`, {}, resident.accessToken);
      const seen = (await classes(resident.accessToken)).find((c) => c.id === yoga.id);
      assert.equal(seen.enrolled, 1, "one resident, one seat");
    });

    test("a seat belongs to a person, so two residents fill two", async () => {
      await post(`/api/amenities/classes/${yoga.id}/enrol`, {}, other.accessToken);
      const seen = (await classes(resident.accessToken)).find((c) => c.id === yoga.id);
      assert.equal(seen.enrolled, 2);
    });

    test("past the last seat you are waitlisted rather than turned away", async () => {
      const small = await post("/api/amenities/classes",
        { name: "Pottery", seats: 1, fee: 500, amenityId: null }, secretary.accessToken);
      const id = small.body.class.id;
      await post(`/api/amenities/classes/${id}/enrol`, {}, resident.accessToken);
      const second = await post(`/api/amenities/classes/${id}/enrol`, {}, other.accessToken);
      assert.equal(second.body.class.mine, "waitlisted");
      assert.equal(second.body.class.enrolled, 1);
      assert.equal(second.body.class.waiting, 1);

      /* And when the seated resident leaves, the person waiting gets the seat
         instead of the class quietly running one short. */
      await del(`/api/amenities/classes/${id}/enrol`, resident.accessToken);
      const after = (await classes(other.accessToken)).find((c) => c.id === id);
      assert.equal(after.mine, "enrolled");
      assert.equal(after.waiting, 0);
    });

    test("leaving a class you are not on says so", async () => {
      const { status } = await del(`/api/amenities/classes/${swimming.id}/enrol`, resident.accessToken);
      assert.equal(status, 409);
    });

    test("a resident cannot start a class or remove one", async () => {
      assert.equal((await post("/api/amenities/classes", { name: "Free-for-all" }, resident.accessToken)).status, 403);
      assert.equal((await del(`/api/amenities/classes/${swimming.id}`, resident.accessToken)).status, 403);
    });
  });

  describe("another society", () => {
    test("cannot see or book this one's amenities", async () => {
      /* Setup mints a second society; its administrator must not find the
         clubhouse next door on their list. */
      const setup = await call("POST", "/api/setup", {
        body: {
          society: { name: "Sunrise Residency" },
          admin: { name: "Nikhil Misal", email: "nikhil@sunrise.test", password: "a-properly-long-passphrase" },
        },
        headers: { "x-setup-token": process.env.SETUP_TOKEN },
      });
      assert.equal(setup.status, 201, JSON.stringify(setup.body));
      const theirs = await login("nikhil@sunrise.test", "a-properly-long-passphrase");

      assert.deepEqual(await amenities(theirs.accessToken), [], "a new society starts empty");
      const { status } = await post("/api/amenities/bookings",
        { amenityId: hall.id, date: day(20), slot: "09:00–13:00" }, theirs.accessToken);
      assert.equal(status, 404, "the hall does not exist as far as they are concerned");
    });
  });
});
