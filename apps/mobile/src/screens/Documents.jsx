/**
 * Document vault.
 *
 * Documents never pass through the API server — the download is a short-lived
 * presigned GET handed to the system browser, which is what can actually render
 * a PDF and put it in Downloads, and the upload goes straight to S3.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITY, MAX_DOCUMENT_BYTES, humanSize,
} from '@gvs/shared';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Bar, Btn, Chips, Confirm, Empty, H4, Input, ListGroup, Muted,
  SearchBar, Select, Sheet, SkeletonList, Tiny, useForm,
} from '../components/ui';
import { useDocuments } from '../data/documents';
import { fmtDate } from '../lib/format';
import { colors as c, PAD } from '../theme';

/* Straight from @gvs/shared, which is also what the API validates against.
   Inventing labels here is how a filter chip ends up querying a category the
   server has never heard of and silently returning nothing. */
const CATEGORY_FILTERS = [
  { value: '', label: 'All' },
  ...DOCUMENT_CATEGORIES.map((x) => ({ value: x, label: x })),
];

const VISIBILITY_OPTIONS = [
  { value: 'residents', label: 'Every resident' },
  { value: 'committee', label: 'Committee only' },
];

export default function Documents() {
  const nav = useNavigation();
  const [category, setCategory] = useState('');
  const docs = useDocuments({ category: category || undefined });
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [uploading, setUploading] = useState(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs.documents;
    return docs.documents.filter((d) => d.name?.toLowerCase().includes(needle));
  }, [docs.documents, q]);

  const startUpload = async () => {
    const file = await docs.pick();
    if (file) setUploading(file);
  };

  return (
    <Screen
      title="Documents"
      onBack={() => nav.goBack()}
      onRefresh={docs.refetch}
      right={docs.canWrite && docs.canPick
        ? <Btn size="sm" icon={Icons.Upload} onPress={startUpload}>Upload</Btn>
        : null}
    >
      {/* Without S3 configured the API answers 503 on these endpoints rather
          than failing at boot, so say which of the two it is. */}
      {docs.error?.status === 503 ? (
        <Alert kind="warn" icon={Icons.Alert}>
          The document vault is not configured on this server yet.
        </Alert>
      ) : null}

      {docs.progress != null ? (
        <View style={s.progress}>
          <View style={s.progressRow}>
            <Tiny>Uploading…</Tiny>
            <Tiny>{docs.progress}%</Tiny>
          </View>
          <Bar value={docs.progress} max={100} color={c.accent} />
        </View>
      ) : null}

      <SearchBar value={q} onChange={setQ} placeholder="Search documents…" />
      <Chips value={category} onChange={setCategory} options={CATEGORY_FILTERS} />

      {docs.loading && !docs.documents.length ? <SkeletonList rows={5} /> : list.length ? (
        <ListGroup>
          {list.map((d) => (
            <Pressable
              key={d.id}
              style={s.li}
              android_ripple={{ color: c.n100 }}
              onPress={() => docs.open(d)}
              onLongPress={docs.canWrite ? () => setConfirm(d) : undefined}
            >
              <View style={s.icoTile}><Icons.Doc size={18} color={c.ink4} /></View>
              <View style={s.grow}>
                <H4 numberOfLines={2}>{d.name}</H4>
                <Tiny style={{ marginTop: 3 }}>
                  {/* `at` and `sizeBytes` are the serializer's names — see
                     the serialize() in apps/api/src/routes/documents.js. */}
                  {[d.category, d.sizeBytes ? humanSize(d.sizeBytes) : null,
                    d.at ? fmtDate(d.at) : null].filter(Boolean).join(' · ')}
                </Tiny>
                {d.uploadedByName ? (
                  <Tiny style={{ marginTop: 2 }}>Uploaded by {d.uploadedByName}</Tiny>
                ) : null}
              </View>
              {d.visibility === 'committee' ? <Badge color="amber">Committee</Badge> : null}
              <Icons.Download size={16} color={c.ink3} />
            </Pressable>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Folder}
          title={q ? `Nothing matches "${q}"` : category ? `No documents in ${category}` : 'No documents yet'}
          note="Bye-laws, AGM minutes and audited accounts are kept here."
          action={docs.canWrite && docs.canPick
            ? <Btn icon={Icons.Upload} onPress={startUpload}>Upload a document</Btn>
            : null}
        />
      )}

      {uploading ? (
        <UploadSheet
          file={uploading}
          progress={docs.progress}
          onClose={() => setUploading(null)}
          onUpload={docs.upload}
        />
      ) : null}

      {confirm ? (
        <Confirm
          title="Remove document?"
          body={`"${confirm.name}" will be deleted from the vault for everyone.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => docs.remove(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Naming and filing the picked file.
 *
 * The file is already chosen by this point — the picker runs first, because
 * asking somebody to fill in a form and *then* discovering their file is too big
 * is the wrong order. The name defaults to the file's own, minus the extension,
 * since that is usually most of what the person would have typed.
 */
function UploadSheet({ file, progress, onClose, onUpload }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({
    name: String(file.name || '').replace(/\.[^.]+$/, ''),
    category: DOCUMENT_CATEGORIES[0],
    visibility: DOCUMENT_VISIBILITY[0],
  });

  const submit = async () => {
    setBusy(true);
    const r = await onUpload({ file, ...f.all() });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="Upload a document" onClose={onClose}>
      <View style={s.file}>
        <View style={s.icoTile}><Icons.Doc size={20} color={c.ink3} /></View>
        <View style={s.grow}>
          <H4 numberOfLines={1}>{file.name}</H4>
          <Tiny style={{ marginTop: 2 }}>
            {[file.size ? humanSize(file.size) : null, file.type].filter(Boolean).join(' · ')}
          </Tiny>
        </View>
      </View>

      <Input
        label="Name"
        placeholder="e.g. AGM minutes, March 2026"
        hint="What residents will see in the list."
        {...f.bind('name')}
      />
      <Select
        label="Category"
        value={f.f.category}
        onChange={(v) => f.set('category', v)}
        options={DOCUMENT_CATEGORIES}
      />
      <Select
        label="Who can see it"
        value={f.f.visibility}
        onChange={(v) => f.set('visibility', v)}
        options={VISIBILITY_OPTIONS}
      />

      {f.f.visibility === 'committee' ? (
        <Alert kind="info" icon={Icons.Lock}>
          Committee-only documents are absent from a resident's response entirely —
          not hidden in the app, never sent.
        </Alert>
      ) : null}

      <Muted style={{ marginBottom: 12 }}>
        Up to {humanSize(MAX_DOCUMENT_BYTES)}. The file goes straight to the society's
        storage; it does not pass through the app's server.
      </Muted>

      {progress != null ? (
        <View style={s.progress}>
          <View style={s.progressRow}>
            <Tiny>Uploading…</Tiny>
            <Tiny>{progress}%</Tiny>
          </View>
          <Bar value={progress} max={100} color={c.accent} />
        </View>
      ) : null}

      <Btn block icon={Icons.Upload} onPress={submit} loading={busy} disabled={!f.f.name.trim()}>
        {busy ? 'Uploading…' : 'Upload'}
      </Btn>

      {/* The upload belongs to the hook, not to this sheet, so leaving does not
          cancel it — the same bar keeps counting on the screen underneath. Worth
          offering explicitly: a 25 MB file over a phone connection is a long time
          to stare at a modal. */}
      {busy ? (
        <Btn block variant="ghost" style={{ marginTop: 8 }} onPress={onClose}>
          Leave this running
        </Btn>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
  progress: { marginTop: 10, marginBottom: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  file: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.n50, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 16,
  },
});
