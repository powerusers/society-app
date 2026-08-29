/**
 * Community — the committee's notice board, polls, and the residents' forum.
 *
 * Reading, commenting and reacting are open to every member. Posting a notice,
 * pinning and removing carry the committee's voice and sit behind notice.write.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Btn, Card, Empty, H3, H4, Input, ListGroup, Muted, Section,
  Segmented, Sheet, SkeletonCard, Tiny, Bar, TextArea, useForm,
} from '../components/ui';
import { NoticeCard } from '../components/entities';
import { PostNoticeSheet } from '../components/sheets';
import { useApp } from '../store';
import { useNotices, usePolls, usePosts } from '../data/community';
import { ago, fmtDate, pct } from '../lib/format';
import { colors as c, PAD } from '../theme';

const TABS = [
  { value: 'notices', label: 'Notices' },
  { value: 'polls', label: 'Polls' },
  { value: 'forum', label: 'Forum' },
];

export default function Community() {
  const { can } = useApp();
  const [tab, setTab] = useState('notices');
  const notices = useNotices();
  const polls = usePolls();
  const posts = usePosts();
  const [sheet, setSheet] = useState(null);
  const [openNotice, setOpenNotice] = useState(null);

  const refresh = () => Promise.all([notices.refetch(), polls.refetch(), posts.refetch()]);

  return (
    <Screen
      title="Community"
      onRefresh={refresh}
      right={can('notice.write') && tab === 'notices'
        ? <Btn size="sm" icon={Icons.Plus} onPress={() => setSheet('notice')}>Post</Btn>
        : null}
    >
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === 'notices' ? (
        <View style={{ marginTop: 12 }}>
          {notices.loading && !notices.notices.length ? <SkeletonCard /> : null}
          {notices.notices.map((n) => (
            <NoticeCard key={n.id} n={n} onPress={() => { setOpenNotice(n); notices.markRead(n.id); }} />
          ))}
          {!notices.loading && !notices.notices.length ? (
            <Empty
              icon={Icons.Board}
              title="No notices yet"
              note={can('notice.write')
                ? 'Post one — every resident in the society sees it.'
                : 'Notices from the committee appear here.'}
            />
          ) : null}
        </View>
      ) : null}

      {tab === 'polls' ? (
        <View style={{ marginTop: 12 }}>
          {polls.polls.map((p) => <PollCard key={p.id} p={p} onVote={polls.vote} />)}
          {!polls.loading && !polls.polls.length ? (
            <Empty icon={Icons.Poll} title="No polls running" note="Committee polls appear here while they are open." />
          ) : null}
        </View>
      ) : null}

      {tab === 'forum' ? (
        <View style={{ marginTop: 12 }}>
          <Btn block variant="outline" icon={Icons.Plus} onPress={() => setSheet('post')} style={{ marginBottom: 12 }}>
            Start a discussion
          </Btn>
          {posts.posts.map((p) => (
            <Card key={p.id}>
              <View style={s.row}>
                <Badge color="brand">{p.type}</Badge>
                <Tiny>{ago(p.at)}</Tiny>
              </View>
              <H3 style={{ marginTop: 7, marginBottom: 4 }}>{p.title}</H3>
              {p.body ? <Muted numberOfLines={4}>{p.body}</Muted> : null}
              {p.price != null ? <H4 style={{ marginTop: 6 }}>₹{p.price}</H4> : null}
              <View style={[s.row, { marginTop: 11 }]}>
                <Tiny>{p.author}</Tiny>
                <View style={s.wrap}>
                  <Pressable onPress={() => posts.like(p.id)} hitSlop={8} style={s.likeBtn}>
                    <Icons.Heart size={13} color={p.likedByMe ? c.bad : c.ink4} />
                    <Tiny>{p.likes || 0}</Tiny>
                  </Pressable>
                  <Badge bare>{p.comments?.length || 0} replies</Badge>
                </View>
              </View>
            </Card>
          ))}
          {!posts.loading && !posts.posts.length ? (
            <Empty icon={Icons.Chat} title="Nothing posted yet" note="Recommendations, classifieds and discussions from your neighbours." />
          ) : null}
        </View>
      ) : null}

      {sheet === 'notice' ? <PostNoticeSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'post' ? <NewPostSheet onClose={() => setSheet(null)} onCreate={posts.create} /> : null}
      {openNotice ? (
        <NoticeSheet
          n={openNotice}
          onClose={() => setOpenNotice(null)}
          onComment={notices.comment}
          onReact={notices.react}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Tallies stay hidden until this resident has voted. Showing a running count
 * beforehand is how a poll turns into a bandwagon.
 */
function PollCard({ p, onVote }) {
  const voted = !!p.myVote;
  const total = (p.options || []).reduce((sum, o) => sum + (o.votes || 0), 0);

  return (
    <Card>
      <View style={s.row}>
        <Badge color={p.status === 'open' ? 'green' : ''}>{p.status}</Badge>
        <Tiny>{p.status === 'open' ? `Closes ${fmtDate(p.closesAt)}` : `Closed ${fmtDate(p.closesAt)}`}</Tiny>
      </View>
      <H3 style={{ marginTop: 8, marginBottom: 10 }}>{p.question}</H3>

      {(p.options || []).map((o) => {
        const share = pct(o.votes || 0, total);
        return voted || p.status !== 'open' ? (
          <View key={o.id} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <H4 style={[s.grow, p.myVote === o.id && { color: c.accent }]}>{o.text}</H4>
              <Tiny>{share}% · {o.votes || 0}</Tiny>
            </View>
            <Bar value={o.votes || 0} max={total} color={p.myVote === o.id ? c.accent : c.n400} />
          </View>
        ) : (
          <Btn key={o.id} variant="outline" block style={{ marginBottom: 7 }} onPress={() => onVote(p.id, o.id)}>
            {o.text}
          </Btn>
        );
      })}

      <Tiny style={{ marginTop: 4 }}>
        {voted || p.status !== 'open' ? `${total} vote${total === 1 ? '' : 's'}` : 'Results appear after you vote'}
      </Tiny>
    </Card>
  );
}

const REACTIONS = ['👍', '🎉', '❤️', '👀'];

function NoticeSheet({ n, onClose, onComment, onReact }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const r = await onComment(n.id, text.trim());
    setBusy(false);
    if (r.ok) setText('');
  };

  return (
    <Sheet title={n.title} onClose={onClose}>
      <Tiny style={{ marginBottom: 10 }}>{n.author} · {ago(n.at)}</Tiny>
      <Muted style={{ marginBottom: 14 }}>{n.body}</Muted>

      <View style={s.wrap}>
        {REACTIONS.map((e) => (
          <Pressable key={e} onPress={() => onReact(n.id, e)} style={s.reaction}>
            <Tiny style={{ fontSize: 15 }}>{e}</Tiny>
            <Tiny>{n.reactions?.[e] || 0}</Tiny>
          </Pressable>
        ))}
      </View>

      <Section title={`Comments (${n.comments?.length || 0})`} />
      <ListGroup>
        {(n.comments || []).map((cm) => (
          <View key={cm.id} style={s.li}>
            <View style={s.grow}>
              <H4>{cm.author}</H4>
              <Muted style={{ marginTop: 2 }}>{cm.body}</Muted>
              <Tiny style={{ marginTop: 3 }}>{ago(cm.at)}</Tiny>
            </View>
          </View>
        ))}
        {!n.comments?.length ? <View style={s.li}><Tiny>No comments yet.</Tiny></View> : null}
      </ListGroup>

      <Input placeholder="Write a comment…" value={text} onChangeText={setText} />
      <Btn block icon={Icons.Send} onPress={send} loading={busy} disabled={!text.trim()}>Comment</Btn>
    </Sheet>
  );
}

function NewPostSheet({ onClose, onCreate }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ type: 'discussion', title: '', body: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onCreate({ type: f.f.type, title: f.f.title.trim(), body: f.f.body.trim() });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="Start a discussion" onClose={onClose}>
      <Alert kind="info">This is the residents' board — everyone in the society can reply.</Alert>
      <Input label="Title" placeholder="e.g. Recommendation for a good electrician?" {...f.bind('title')} />
      <TextArea label="Details" placeholder="Write your post…" {...f.bind('body')} />
      <Btn block icon={Icons.Send} onPress={submit} loading={busy} disabled={f.f.title.trim().length < 3}>Post</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reaction: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: c.lineStrong, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 11, marginBottom: 6,
  },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
