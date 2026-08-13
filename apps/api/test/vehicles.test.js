/**
 * Registered vehicles and parking slots.
 *
 * A parking slot is the second thing in this app two residents can collide
 * over. P1-42 belongs to one car; two flats each believing it is theirs is a
 * dispute the committee referees in person, and the browser-local register
 * could not tell them apart because neither ever saw the other's entry.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, del, login, ACCOUNTS } from "./helpers.js";

describe("vehicles", () => {
  let secretary, resident, other, guard;

  const register = async (token) => (await get("/api/vehicles", token)).body;

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    guard = await login(ACCOUNTS.guard);
  });

  after(stopTestServer);

  describe("who sees what", () => {
    test("a resident sees their own flat's vehicles", async () => {
      const { vehicles, scope } = await register(resident.accessToken);
      assert.equal(scope, "flat");
      assert.ok(vehicles.length >= 2, "the seeded flat has a car and a scooter");
      assert.ok(vehicles.every((v) => v.flatCode === "A-401"));
    });

    test("and not the neighbour's", async () => {
      const { vehicles } = await register(other.accessToken);
      assert.ok(vehicles.every((v) => v.flatCode !== "A-401"), "C-105 does not get to read A-401's register");
    });

    test("but a guard sees the whole society, because that is the register's job", async () => {
      const { vehicles, scope } = await register(guard.accessToken);
      assert.equal(scope, "society");
      assert.ok(vehicles.length >= 3);
    });
  });

  describe("registering one", () => {
    test("goes against the flat the resident lives in", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Car", model: "Maruti Swift", number: "MH-14-XY-4321" }, other.accessToken);
      assert.equal(status, 201);
      assert.equal(body.vehicle.flatCode, "C-105");
      assert.equal(body.vehicle.number, "MH-14-XY-4321", "shown the way it is written on the car");
      assert.match(body.vehicle.sticker, /^\d{4}$/);
    });

    test("however the plate was punctuated", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Bike", model: "Royal Enfield", number: "mh 14 zz 9999" }, other.accessToken);
      assert.equal(status, 201);
      assert.equal(body.vehicle.number, "MH-14-ZZ-9999");
    });

    test("and the same car cannot be registered twice", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Car", model: "Swift again", number: "MH14XY4321" }, other.accessToken);
      assert.equal(status, 409);
      assert.match(body.error.message, /already on the society's register/);
    });

    test("not even by another flat — that is a dispute, not a duplicate", async () => {
      const { status } = await post("/api/vehicles",
        { kind: "Car", model: "Someone else's Swift", number: "MH-14-XY-4321" }, resident.accessToken);
      assert.equal(status, 409);
    });

    test("a resident cannot register one against a neighbour's flat", async () => {
      const { status } = await post("/api/vehicles",
        { kind: "Car", model: "Not mine", number: "MH01AA0001", flatCode: "B-201" }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("the committee can, for a resident who rang the office", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Car", model: "Honda City", number: "MH01AA0002", flatCode: "B-302" }, secretary.accessToken);
      assert.equal(status, 201);
      assert.equal(body.vehicle.flatCode, "B-302");
    });

    test("something that is not a registration number is refused", async () => {
      const { status } = await post("/api/vehicles", { kind: "Car", model: "Ghost", number: "MH1" }, resident.accessToken);
      assert.equal(status, 422);
    });
  });

  describe("parking slots", () => {
    test("a slot already allotted to another car is refused", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Car", model: "Interloper", number: "MH02BB1111", slot: "P1-08" }, other.accessToken);
      assert.equal(status, 409);
      assert.match(body.error.message, /already allotted/);
    });

    test("even when both claims arrive at once", async () => {
      /* Check-then-insert passes both; the unique index is what decides. */
      const results = await Promise.all([
        post("/api/vehicles", { kind: "Car", model: "First", number: "MH03CC0001", slot: "P3-99" }, other.accessToken),
        post("/api/vehicles", { kind: "Car", model: "Second", number: "MH03CC0002", slot: "P3-99" }, secretary.accessToken),
      ]);
      const codes = results.map((r) => r.status).sort();
      assert.deepEqual(codes, [201, 409], "exactly one car got the slot");
    });

    test("a flat cannot claim more slots than it was allotted", async () => {
      /* A-401 is a seeded flat with its parking already claimed by the car and
         the scooter, so the third one has nowhere the society said it could go. */
      const { status, body } = await post("/api/vehicles",
        { kind: "Car", model: "Third car", number: "MH04DD2222", slot: "P9-01" }, resident.accessToken);
      assert.equal(status, 422);
      assert.match(body.error.message, /allotted slot/);
    });

    test("but may register a vehicle with no slot at all", async () => {
      const { status, body } = await post("/api/vehicles",
        { kind: "Bike", model: "Spare scooter", number: "MH04DD3333" }, resident.accessToken);
      assert.equal(status, 201, "parking on the road is still a vehicle the gate should recognise");
      assert.equal(body.vehicle.slot, "");
    });

    test("giving one up frees the slot for somebody else", async () => {
      const mine = (await register(resident.accessToken)).vehicles.find((v) => v.slot === "P1-42");
      assert.equal((await del(`/api/vehicles/${mine.id}`, resident.accessToken)).status, 204);
      /* Registered for a flat with its own allotment spare — the slot being
         free is the point, not who ends up in it. */
      const { status } = await post("/api/vehicles",
        { kind: "Car", model: "Next in line", number: "MH05EE4444", slot: "P1-42", flatCode: "D-102" },
        secretary.accessToken);
      assert.equal(status, 201);
    });

    test("and a slot can be changed on a vehicle already registered", async () => {
      const mine = (await register(other.accessToken)).vehicles.find((v) => v.number === "MH-14-ZZ-9999");
      const { status, body } = await patch(`/api/vehicles/${mine.id}`, { slot: "B-77" }, other.accessToken);
      assert.equal(status, 200);
      assert.equal(body.vehicle.slot, "B-77");
    });
  });

  describe("the gate", () => {
    test("can look a car up by its plate, however it is typed", async () => {
      const { status, body } = await get("/api/vehicles/plate/mh 12 cd 5678", guard.accessToken);
      assert.equal(status, 200);
      assert.equal(body.vehicle.flatCode, "A-401");
      assert.equal(body.vehicle.model, "Honda Activa");
    });

    test("and is told plainly when a car is not on the register", async () => {
      const { status } = await get("/api/vehicles/plate/MH99ZZ0000", guard.accessToken);
      assert.equal(status, 404);
    });

    test("a resident cannot use it to look up their neighbours", async () => {
      const { status } = await get("/api/vehicles/plate/MH12EF9012", resident.accessToken);
      assert.equal(status, 403, "the register is not a directory of who drives what");
    });
  });

  describe("taking one off the register", () => {
    test("a neighbour cannot remove your vehicle", async () => {
      const theirs = (await register(guard.accessToken)).vehicles.find((v) => v.flatCode === "B-201");
      assert.equal((await del(`/api/vehicles/${theirs.id}`, other.accessToken)).status, 403);
    });

    test("the committee can, for a resident who has moved out", async () => {
      const theirs = (await register(secretary.accessToken)).vehicles.find((v) => v.flatCode === "B-302");
      assert.equal((await del(`/api/vehicles/${theirs.id}`, secretary.accessToken)).status, 204);
    });
  });
});
