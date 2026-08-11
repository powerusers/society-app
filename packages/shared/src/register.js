/**
 * The society's flat register: parsing it out of a spreadsheet, and validating
 * what comes back.
 *
 * This lives in shared because the browser previews an import and the API
 * performs it. Two parsers would drift, and the drift would only ever show up
 * as "the preview said 150 flats and the import wrote 148".
 */

/* Real exports come out of Excel, Tally and a dozen society-management tools,
   each with its own idea of what the columns are called. Matching liberally
   here costs nothing and saves the admin editing the file by hand. */
const HEADER_ALIASES = {
  code: ["code", "flat", "flatcode", "flatno", "flatnumber", "unit", "unitno", "flat no", "flat_no"],
  block: ["block", "wing", "tower", "building"],
  floor: ["floor", "level", "flr"],
  type: ["type", "flattype", "config", "configuration", "bhk"],
  area: ["area", "carpetarea", "carpet", "sqft", "areasqft", "carpet area", "builtup", "builtuparea"],
  occupancy: ["occupancy", "status", "occupiedby", "occupation"],
  parkingSlots: ["parking", "parkingslots", "slots", "parkingcount", "car parking"],
};

const OCCUPANCY = ["owner-occupied", "tenant-occupied", "vacant"];

const norm = (s) => String(s).toLowerCase().replace(/[\s._-]/g, "");

/** Maps a row of header cells onto our field names, ignoring ones we don't know. */
export function mapHeaders(cells) {
  const out = {};
  cells.forEach((cell, i) => {
    const key = norm(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => norm(a) === key)) { out[field] = i; return; }
    }
  });
  return out;
}

/**
 * A small RFC-4180 reader: quoted fields, embedded commas and doubled quotes.
 *
 * Splitting on commas would be shorter and would corrupt any address or flat
 * type containing one, silently shifting every later column in that row.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = String(text ?? "").replace(/^﻿/, ""); // Excel writes a BOM

  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { endField(); continue; }
    if (c === "\r") continue;
    if (c === "\n") { endRow(); continue; }
    field += c;
  }
  if (field !== "" || row.length) endRow();

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

/** "A-1003" -> 10, "A-401" -> 4. A four-digit flat is floor ten, not floor one. */
export function deriveFloor(number) {
  const digits = String(number).replace(/\D/g, "");
  if (digits.length <= 2) return 1;
  if (digits.length === 3) return Number(digits[0]);
  return Number(digits.slice(0, digits.length - 2));
}

/**
 * Validates one register row.
 *
 * `area` is required rather than defaulted. It is the multiplier on every
 * per-square-foot billing head, so a placeholder would not fail — it would
 * quietly bill every flat in the society the wrong amount, every month, until
 * somebody reconciled by hand.
 */
export function validateFlatRow(raw) {
  const errors = {};
  const code = String(raw.code ?? "").trim().toUpperCase();

  if (!code) errors.code = "Flat code is required";
  else if (!/^[A-Z]{1,2}-\d{1,4}[A-Z]?$/.test(code)) {
    errors.code = `"${code}" is not a flat code — expected something like C-1003`;
  }

  const block = String(raw.block ?? "").trim().toUpperCase() || code.split("-")[0] || "";
  if (!block) errors.block = "Block is required";
  else if (!/^[A-Z]{1,2}$/.test(block)) errors.block = `"${block}" is not a block letter`;
  else if (code && !errors.code && code.split("-")[0] !== block) {
    errors.block = `Block ${block} does not match flat code ${code}`;
  }

  const areaRaw = String(raw.area ?? "").trim();
  let area = null;
  if (!areaRaw) {
    errors.area = "Carpet area is required — it multiplies every per-sqft billing head";
  } else {
    area = Number(areaRaw.replace(/,/g, ""));
    if (!Number.isFinite(area) || area <= 0) errors.area = `"${areaRaw}" is not a valid area`;
    else area = Math.round(area);
  }

  const floorRaw = String(raw.floor ?? "").trim();
  let floor;
  if (floorRaw) {
    floor = Number(floorRaw);
    if (!Number.isInteger(floor) || floor < 0) errors.floor = `"${floorRaw}" is not a floor number`;
  } else {
    floor = deriveFloor(code.split("-")[1] || "");
  }

  const parkingRaw = String(raw.parkingSlots ?? "").trim();
  let parkingSlots = 1;
  if (parkingRaw) {
    parkingSlots = Number(parkingRaw);
    if (!Number.isInteger(parkingSlots) || parkingSlots < 0) {
      errors.parkingSlots = `"${parkingRaw}" is not a parking count`;
    }
  }

  let occupancy = String(raw.occupancy ?? "").trim().toLowerCase() || "owner-occupied";
  if (occupancy === "owner") occupancy = "owner-occupied";
  if (occupancy === "tenant" || occupancy === "rented") occupancy = "tenant-occupied";
  if (!OCCUPANCY.includes(occupancy)) {
    errors.occupancy = `"${raw.occupancy}" is not one of ${OCCUPANCY.join(", ")}`;
  }

  const type = String(raw.type ?? "").trim().toUpperCase() || "2BHK";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    flat: { code, block, floor, type, area, occupancy, parkingSlots },
  };
}

/**
 * Turns a CSV into validated rows, each carrying its source line so an error
 * can be pointed at the spreadsheet the admin is looking at.
 */
export function parseFlatRegister(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, error: "The file is empty", rows: [] };

  const cols = mapHeaders(rows[0]);
  if (cols.code === undefined) {
    return {
      ok: false,
      rows: [],
      error: "No flat code column found — the first row must name the columns, including one like 'code' or 'flat no'",
    };
  }
  if (cols.area === undefined) {
    return {
      ok: false,
      rows: [],
      error: "No carpet area column found — add one named 'area' or 'carpet area'",
    };
  }

  const pick = (cells, field) => (cols[field] === undefined ? "" : cells[cols[field]] ?? "");
  const seen = new Map();
  const out = [];

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2; // header is line 1, and spreadsheets count from 1
    const result = validateFlatRow({
      code: pick(cells, "code"), block: pick(cells, "block"), floor: pick(cells, "floor"),
      type: pick(cells, "type"), area: pick(cells, "area"),
      occupancy: pick(cells, "occupancy"), parkingSlots: pick(cells, "parkingSlots"),
    });

    /* A duplicate code inside one file is a mistake in the file. Upserting it
       twice would apply whichever row happened to come last, so refuse it and
       name the line it collides with. */
    const prior = seen.get(result.flat.code);
    if (result.ok && prior) {
      result.ok = false;
      result.errors.code = `Flat ${result.flat.code} also appears on line ${prior}`;
    } else if (result.ok) {
      seen.set(result.flat.code, line);
    }

    out.push({ line, ...result });
  });

  return { ok: true, rows: out };
}

/** Blocks the society actually has, derived from the register rather than typed. */
export const blocksOf = (flats) =>
  [...new Set(flats.map((f) => f.block))].sort((a, b) => a.localeCompare(b));

/** A file the admin can fill in, rather than guessing the format from prose. */
export const REGISTER_TEMPLATE = [
  "code,block,floor,type,area,occupancy,parking",
  "A-101,A,1,2BHK,845,owner-occupied,1",
  "A-102,A,1,3BHK,1120,tenant-occupied,2",
  "B-1003,B,10,2BHK,910,vacant,1",
].join("\n");
