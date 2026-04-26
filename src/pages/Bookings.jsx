import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge } from '../components/Card.jsx';

const STATUS_OPTIONS = ['all', 'searching', 'accepted', 'at_pickup', 'in_progress', 'at_drop', 'completed', 'cancelled'];
const STATUS_COLORS = { searching: '#3B82F6', accepted: '#F59E0B', at_pickup: '#8B5CF6', in_progress: '#10B981', at_drop: '#10B981', completed: '#6B7280', cancelled: '#EF4444' };
const STATUS_LABELS = { searching: 'Finding Driver', accepted: 'Driver Coming', at_pickup: 'At Pickup', in_progress: 'In Progress', at_drop: 'At Drop', completed: 'Completed', cancelled: 'Cancelled' };

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setBookings(data);
    });
    return () => unsub();
  }, []);

  const filtered = bookings.filter((b) => {
    const matchStatus = filter === 'all' || b.status === filter;
    const matchSearch = !search || b.customerName?.toLowerCase().includes(search.toLowerCase()) || b.driverName?.toLowerCase().includes(search.toLowerCase()) || b.pickup?.address?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const cancelBooking = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
    setSelected(null);
  };

  const fmt = (p) => `₹${Math.round((p || 0) / 100)}`;
  const fmtDate = (ts) => ts?.toDate ? ts.toDate().toLocaleString() : '—';

  return (
    <div>
      <PageTitle title="📦 Bookings" sub="View and manage all delivery bookings" />

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Search customer, driver, address..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240, padding: '10px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '10px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? `All (${bookings.length})` : `${STATUS_LABELS[s]} (${bookings.filter((b) => b.status === s).length})`}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
        <Card style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                  {['Customer', 'Driver', 'Vehicle', 'Fare', 'Payment', 'Status', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} onClick={() => setSelected(b)}
                    style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', backgroundColor: selected?.id === b.id ? '#10B98108' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{b.customerName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{b.driverName || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.vehicleLabel}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10B981' }}>{fmt(b.fare?.totalInPaise)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{b.paymentMethod === 'cod' ? '💵 COD' : '💳 UPI'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ backgroundColor: (STATUS_COLORS[b.status] || '#9CA3AF') + '20', color: STATUS_COLORS[b.status] || '#9CA3AF', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{fmtDate(b.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No bookings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Detail */}
        {selected && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Booking Details</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>

            <div style={{ backgroundColor: (STATUS_COLORS[selected.status] || '#9CA3AF') + '15', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontWeight: 700, color: STATUS_COLORS[selected.status] }}>
              {STATUS_LABELS[selected.status] || selected.status}
            </div>

            <InfoBlock label="CUSTOMER" rows={[['Name', selected.customerName], ['Phone', selected.customerPhone]]} />
            <InfoBlock label="DRIVER" rows={[['Name', selected.driverName || '—'], ['Phone', selected.driverPhone || '—']]} />
            <InfoBlock label="LOCATIONS" rows={[['Pickup', selected.pickup?.address], ['Drop', selected.drop?.address]]} />
            <InfoBlock label="FARE" rows={[
              ['Base', fmt(selected.fare?.baseFare)],
              ['Distance', fmt(selected.fare?.distanceFare)],
              ['Total', fmt(selected.fare?.totalInPaise)],
              ['Payment', selected.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 UPI'],
              ['Commission', fmt(selected.commission?.amountInPaise) + ` (${selected.commission?.status || '—'})`],
            ]} />
            <InfoBlock label="TIMING" rows={[
              ['Created', fmtDate(selected.createdAt)],
              ['Accepted', fmtDate(selected.acceptedAt)],
              ['Completed', fmtDate(selected.completedAt)],
            ]} />
            {selected.pickupOtp && <InfoBlock label="OTPs" rows={[['Pickup OTP', selected.pickupOtp], ['Delivery OTP', selected.deliveryOtp]]} />}

            {selected.status !== 'completed' && selected.status !== 'cancelled' && (
              <button onClick={() => cancelBooking(selected.id)}
                style={{ width: '100%', marginTop: 20, padding: 12, backgroundColor: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                ❌ Cancel Booking
              </button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, rows }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{k}</span>
          <span style={{ fontSize: 13, color: '#1F2937', fontWeight: 500, textAlign: 'right', maxWidth: 180, wordBreak: 'break-all' }}>{v || '—'}</span>
        </div>
      ))}
    </div>
  );
}
