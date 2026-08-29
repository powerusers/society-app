/** Amenities & classes — book the clubhouse, join the yoga class. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Btn, Card, Empty, EmojiTile, H3, H4, Input, ListGroup, Muted,
  Section, Segmented, Sheet, SkeletonList, Tiny, useForm,
} from '../components/ui';
import { useApp } from '../store';
import { useAmenities, useBookings, useClasses } from '../data/amenities';
import { fmtDate, inr } from '../lib/format';
import { colors as c, PAD } from '../theme';

const TABS = [
  { value: 'book', label: 'Book' },
  { value: 'mine', label: 'My bookings' },
  { value: 'classes', label: 'Classes' },
];

export default function Amenities() {
  const nav = useNavigation();
  const { can } = useApp();
  const [tab, setTab] = useState('book');
  const { amenities, loading, refetch } = useAmenities();
  const bookings = useBookings();
  const classes = useClasses();
  const [booking, setBooking] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const mine = bookings.bookings.filter((b) => b.status !== 'cancelled');

  return (
    <Screen
      title="Amenities & Classes"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={() => Promise.all([refetch(), bookings.refetch(), classes.refetch()])}
    >
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === 'book' ? (
        <View style={{ marginTop: 12 }}>
          {loading && !amenities.length ? <SkeletonList rows={4} /> : null}
          {amenities.map((a) => (
            <Card key={a.id}>
              <View style={s.row}>
                <EmojiTile size="lg">{a.emoji}</EmojiTile>
                <View style={s.grow}>
                  <H3>{a.name}</H3>
                  <Tiny style={{ marginTop: 3 }}>
                    {[a.timing, a.capacity ? `Up to ${a.capacity}` : null].filter(Boolean).join(' · ')}
                  </Tiny>
                </View>
                <View style={s.right}>
                  <H4>{a.charge ? inr(a.charge) : 'Free'}</H4>
                  <Badge color={a.status === 'active' ? 'green' : 'red'}>{a.status}</Badge>
                </View>
              </View>
              {a.rules ? <Muted style={{ marginTop: 9 }}>{a.rules}</Muted> : null}
              <Btn
                block
                size="sm"
                icon={Icons.Calendar}
                style={{ marginTop: 12 }}
                disabled={a.status !== 'active'}
                onPress={() => setBooking(a)}
              >
                {a.status === 'active' ? 'Book a slot' : 'Unavailable'}
              </Btn>
            </Card>
          ))}
          {!loading && !amenities.length ? (
            <Empty icon={Icons.Calendar} title="No amenities listed" note="The committee adds bookable amenities here." />
          ) : null}
        </View>
      ) : null}

      {tab === 'mine' ? (
        <View style={{ marginTop: 12 }}>
          <ListGroup>
            {mine.map((b) => (
              <View key={b.id} style={s.li}>
                <EmojiTile>{b.amenityEmoji}</EmojiTile>
                <View style={s.grow}>
                  <H4>{b.amenityName}</H4>
                  <Tiny style={{ marginTop: 2 }}>{fmtDate(b.date)} · {b.slot}</Tiny>
                </View>
                <View style={s.right}>
                  <Badge color={b.status === 'confirmed' ? 'green' : 'amber'}>{b.status}</Badge>
                  {b.date >= today ? (
                    <Btn size="sm" variant="ghost" style={{ marginTop: 6 }} onPress={() => bookings.cancel(b.id)}>
                      Cancel
                    </Btn>
                  ) : null}
                </View>
              </View>
            ))}
          </ListGroup>
          {!mine.length ? <Empty icon={Icons.Calendar} title="No bookings" note="Slots you book appear here." /> : null}
        </View>
      ) : null}

      {tab === 'classes' ? (
        <View style={{ marginTop: 12 }}>
          {classes.classes.map((k) => (
            <Card key={k.id}>
              <View style={s.row}>
                <View style={s.grow}>
                  <H3>{k.name}</H3>
                  <Tiny style={{ marginTop: 3 }}>
                    {[k.instructor, k.schedule, k.venue].filter(Boolean).join(' · ')}
                  </Tiny>
                </View>
                <View style={s.right}>
                  <H4>{k.fee ? inr(k.fee) : 'Free'}</H4>
                  <Tiny>{k.enrolled || 0} enrolled</Tiny>
                </View>
              </View>
              <Btn
                block size="sm" style={{ marginTop: 12 }}
                variant={k.enrolledByMe ? 'outline' : ''}
                onPress={() => (k.enrolledByMe ? classes.leave(k.id) : classes.enrol(k.id))}
              >
                {k.enrolledByMe ? 'Leave class' : 'Enrol'}
              </Btn>
            </Card>
          ))}
          {!classes.loading && !classes.classes.length ? (
            <Empty icon={Icons.Dumbbell} title="No classes running" note="Yoga, skating, music — whatever the society runs." />
          ) : null}
        </View>
      ) : null}

      {booking ? (
        <BookSheet amenity={booking} onClose={() => setBooking(null)} onBook={bookings.book} />
      ) : null}
    </Screen>
  );
}

function BookSheet({ amenity, onClose, onBook }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ date: new Date().toISOString().slice(0, 10), slot: (amenity.slots || [])[0] || '', note: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onBook({ amenityId: amenity.id, date: f.f.date, slot: f.f.slot, note: f.f.note });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title={`Book ${amenity.name}`} onClose={onClose}>
      {amenity.charge ? (
        <Alert kind="info">A charge of {inr(amenity.charge)} is added to next month's bill.</Alert>
      ) : null}
      <Input label="Date" placeholder="YYYY-MM-DD" {...f.bind('date')} />
      <Input label="Slot" placeholder="e.g. 6:00 PM – 8:00 PM" {...f.bind('slot')} />
      <Input label="Note (optional)" placeholder="e.g. Birthday party, 30 guests" {...f.bind('note')} />
      <Btn block icon={Icons.Calendar} onPress={submit} loading={busy} disabled={!f.f.date || !f.f.slot}>
        Request booking
      </Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  right: { alignItems: 'flex-end' },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
