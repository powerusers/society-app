import { ALLOWED_CONTENT_TYPES, resolveContentType } from '@gvs/shared';

/**
 * The system file picker.
 *
 * Guarded the same way as lib/push.js and lib/gate.js: this is a native module,
 * and a bundle built before it was installed would otherwise throw at import
 * time and take the Documents screen down with it. Uploading is an addition to a
 * screen that already lists and downloads, so its absence has to be survivable.
 */

let Picker;
function picker() {
  if (Picker !== undefined) return Picker;
  try {
    // eslint-disable-next-line global-require
    Picker = require('@react-native-documents/picker');
  } catch {
    Picker = null;
  }
  return Picker;
}

export const pickerAvailable = () => !!picker();

/**
 * Opens the picker and returns a file in the shape React Native's FormData
 * wants — { uri, name, type, size } — or null if the user backed out.
 *
 * The uri stays a content:// URI rather than being copied to a real path.
 * Android's platform code reads it directly when building the multipart body,
 * and copying a 25 MB file into the app's cache first would double the write for
 * no gain. `copyTo` is deliberately not used for the same reason.
 */
export async function pickDocument() {
  const lib = picker();
  if (!lib) return null;

  try {
    const [file] = await lib.pick({
      /* The allowlist the API enforces, offered to the system picker so
         unacceptable files are greyed out rather than rejected after the fact. */
      type: Object.keys(ALLOWED_CONTENT_TYPES),
      allowMultiSelection: false,
    });
    if (!file) return null;

    const name = file.name || 'document';

    return {
      uri: file.uri,
      name,
      /* Android's providers are inconsistent about type: an ordinary PDF from
         Drive or a file manager often arrives as application/octet-stream, or as
         null. resolveContentType falls back to the extension for exactly those
         cases, and only ever onto a type already in the allowlist — a file that
         claims to be text/html is not rescued by being named .pdf. Null here
         means "not accepted", which the caller reports. */
      type: resolveContentType(name, file.type),
      /* What the provider actually said, so a refusal can name it. */
      reportedType: file.type || null,
      size: file.size ?? null,
    };
  } catch (err) {
    /* Backing out is a normal outcome, not a failure — as is tapping Upload
       twice, which the library reports as a picker already being open. Neither
       is worth telling anybody about. */
    if (lib.isErrorWithCode?.(err)) {
      const { OPERATION_CANCELED, IN_PROGRESS } = lib.errorCodes || {};
      if (err.code === OPERATION_CANCELED || err.code === IN_PROGRESS) return null;
    }
    throw err;
  }
}
