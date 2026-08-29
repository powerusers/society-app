/**
 * The document vault.
 *
 * Documents never pass through the API server. The client asks for a presigned
 * POST, uploads the bytes straight to S3, then tells the server the object
 * landed — three steps, and the middle one is the only one that moves the file.
 * A 20 MB AGM recording therefore never occupies a Node process.
 *
 * On Android the download hands a short-lived presigned GET to the system
 * browser, which is what can actually render a PDF and put it in Downloads.
 */
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import {
  ALLOWED_CONTENT_TYPES, MAX_DOCUMENT_BYTES, humanSize, isAllowedContentType, safeFileName,
} from '@gvs/shared';
import { useApp } from '../store';
import { useCollection, useWriter } from './base';
import { api, uploadToStorage } from '../lib/api';
import { pickDocument, pickerAvailable } from '../lib/picker';

export function useDocuments({ category } = {}) {
  const { can, say } = useApp();
  const { items, loading, error, refetch } = useCollection(
    `/api/documents${category ? `?category=${encodeURIComponent(category)}` : ''}`,
    'documents',
    { deps: [category] },
  );
  const write = useWriter(refetch);

  /* Progress belongs to the sheet that started the upload, so it lives here
     rather than in that sheet's own state — a resident who backs out mid-upload
     should not silently cancel a transfer that is already running. */
  const [progress, setProgress] = useState(null);

  const open = useCallback(async (doc) => {
    try {
      const { url } = await api.get(`/api/documents/${doc.id}/download`);
      await Linking.openURL(url);
      return { ok: true };
    } catch (err) {
      say(err.message, 'bad');
      return { ok: false, error: err };
    }
  }, [say]);

  const remove = useCallback((id) => write(() => api.del(`/api/documents/${id}`), 'Document removed.'), [write]);

  /**
   * Opens the system file picker and checks what came back.
   *
   * Both checks are the server's too — it re-validates the content type and the
   * size, and S3's presigned policy refuses an oversized body independently. The
   * point of doing them here is that a resident on a phone should be told a
   * 40 MB video is too big *before* it uploads, not after.
   */
  const pick = useCallback(async () => {
    if (!pickerAvailable()) {
      say('File picking is not available in this build.', 'bad');
      return null;
    }

    let file;
    try {
      file = await pickDocument();
    } catch (err) {
      /* The picker throws on anything that is not a cancellation — a provider
         that fails to answer, a file that vanished mid-pick. Without this the
         rejection escapes an onPress handler and the resident sees precisely
         nothing happen. */
      say(err?.message || 'That file could not be opened. Try another.', 'bad');
      return null;
    }
    if (!file) return null; // cancelled, or a picker already open — say nothing

    /* Type first, and it is already resolved: picker.js falls back to the
       extension when the provider reports a vague type, so null here means
       genuinely not accepted rather than merely unlabelled. */
    if (!isAllowedContentType(file.type)) {
      say(
        file.reportedType
          ? `${file.reportedType} files are not accepted. PDFs, images and Office documents are.`
          : 'That file type is not accepted. PDFs, images and Office documents are.',
        'bad',
      );
      return null;
    }
    if (!file.size) {
      /* Rare, but real: a few providers report no size. Declaring sizeBytes up
         front is what lets the API refuse an oversized file before a byte moves,
         so guessing would defeat the check rather than satisfy it. Saving the
         file to the device first gives it a size the provider will report. */
      say('That file’s size could not be read. Save it to this device first, then upload.', 'bad');
      return null;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      say(`That file is ${humanSize(file.size)} — the limit is ${humanSize(MAX_DOCUMENT_BYTES)}.`, 'bad');
      return null;
    }
    return file;
  }, [say]);

  /**
   * The three-step upload.
   *
   * Failing between steps two and three leaves a `pending` row with an object
   * behind it that nothing points at; the API's /sweep endpoint clears those.
   * That is better than the alternative — recording the document first and
   * discovering the bytes never arrived.
   */
  const upload = useCallback(async ({ file, name, category: cat, visibility }) => {
    setProgress(0);
    try {
      const { document, upload: presigned } = await api.post('/api/documents/upload-url', {
        name: name.trim(),
        fileName: safeFileName(file.name),
        category: cat,
        visibility,
        contentType: file.type,
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned, file, setProgress);
      await api.post(`/api/documents/${document.id}/complete`);

      await refetch();
      say('Document uploaded.');
      return { ok: true, document };
    } catch (err) {
      say(err.message, 'bad');
      return { ok: false, error: err };
    } finally {
      setProgress(null);
    }
  }, [refetch, say]);

  return {
    documents: items,
    loading,
    error,
    refetch,
    open,
    remove,
    pick,
    upload,
    progress,
    canWrite: can('document.write'),
    /* The picker is a native module; a build without it should offer no button
       rather than a button that fails. */
    canPick: pickerAvailable(),
    accepted: Object.values(ALLOWED_CONTENT_TYPES),
  };
}
