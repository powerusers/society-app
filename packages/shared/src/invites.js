/**
 * Invite codes for onboarding a society.
 *
 * These are typed by a person off a message or an email, so the alphabet
 * leaves out every character that gets misread by hand: I, L, O, 0 and 1.
 * What remains is 31 symbols, and twelve of them carry about 59 bits — far
 * past guessing, while still short enough to read down a phone.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const PER_GROUP = 4;

/** Groups of four, because a 12-character run gets miscopied. */
export const formatInviteCode = (raw) =>
  (String(raw).match(/.{1,4}/g) || []).join("-");

/**
 * What the user typed, reduced to what we compare.
 *
 * People paste codes with the dashes, without them, in lower case, and with a
 * trailing space from the copy. All of those are the same code.
 */
export const normaliseInviteCode = (input) =>
  String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const INVITE_CODE_LENGTH = GROUPS * PER_GROUP;

/** True for something shaped like a code — not that any such code exists. */
export const looksLikeInviteCode = (input) => {
  const c = normaliseInviteCode(input);
  return c.length === INVITE_CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch));
};

/**
 * @param {(max:number)=>number} randomInt — injected so the API can pass a
 * cryptographic source; there is no good default for this in shared code, and
 * Math.random would produce guessable codes.
 */
export function generateInviteCode(randomInt) {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return formatInviteCode(out);
}

export const INVITE_DEFAULT_DAYS = 14;
