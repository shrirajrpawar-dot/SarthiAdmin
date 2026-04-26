import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, StatCard } from '../components/Card.jsx';

export default function Commission() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.paymentMethod === 'cod' && b.status === 'completed');
      data.sort((a, b) => (b.completedAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || 0));
      setBookings(data);
    });
    return () => unsub();
  }, []);

  const pending = bookings.filter((b) => b.commission?.status === 'pending_from_driver');
  const collected = bookings.filter((b) => b.commission?.status === 'collected');
  const totalPending = pending.reduce((s, b) => s + (b.commission?.amountInPaise || 0), 0);
  const totalCollected = collected.reduce((s, b) => s + (b.commission?.amountInPaise || 0), 0);

  // Commission breakdown by vehicle
  const commissionByVehicle = {};
  bookings.forEach((b) => {
    const key = b.vehicleLabel || 'Unknown';
    if (!commissionByVehicle[key]) {
      commissionByVehicle[key] = { count: 0, total: 0, pct: b.commission?.pct || 20 };
    }
    commissionByVehicle[key].count += 1;
    commissionByVehicle[key].total += (b.commission?.amountInPaise || 0);
  });

  const markPaid = async (bookingId) => {
    if (!confirm('Mark this commission as collected?')) return;
    await updateDoc(doc(db, 'bookings', bookingId), {
      'commission.status': 'collected',
      'commission.paidAt': new Date().toISOString(),
    });
  };

  const markAllPaid = async (driverBookings) => {
    if (!confirm(`Mark all ${driverBookings.length} pending commissions as collected?`)) return;
    for (const b of driverBookings) {
      await updateDoc(doc(db, 'bookings', b.id), { 'commission.status': 'collected', 'commission.paidAt': new Date().toISOString() });
    }
  };

  // Group pending by driver
  const byDriver = {};
  pending.forEach((b) => {
    const key = b.driverId;
    if (!byDriver[key]) byDriver[key] = { name: b.driverName, phone: b.driverPhone, bookings: [] };
    byDriver[key].bookings.push(b);
  });

  const fmt = (p) => `₹${Math.round((p || 0) / 100)}`;

  return (
    <div>
      <PageTitle title="💰 Commission Tracking" sub="COD bookings — commission owed to LoadGo" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon="⚠️" label="Pending Commission" value={fmt(totalPending)} color="#EF4444" sub={`${pending.length} bookings`} />
        <StatCard icon="✅" label="Collected Commission" value={fmt(totalCollected)} color="#10B981" sub={`${collected.length} bookings`} />
        <StatCard icon="📊" label="Total COD Bookings" value={bookings.length} color="#3B82F6" />
      </div>

      {/* Commission Breakdown by Vehicle Type */}
      {Object.keys(commissionByVehicle).length > 0 && (
        <Card style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', marginBottom: 16 }}>📈 Commission Breakdown by Vehicle Type</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                {['Vehicle Type', 'Bookings', 'Commission %', 'Total Earned'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(commissionByVehicle).map(([vehicle, data]) => (
                <tr key={vehicle} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{vehicle}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{data.count}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#10B981' }}>{data.pct}%</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10B981' }}>{fmt(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Pending by Driver */}
      {Object.keys(byDriver).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 16 }}>⚠️ Pending by Driver</h2>
          {Object.entries(byDriver).map(([driverId, data]) => {
            const total = data.bookings.reduce((s, b) => s + (b.commission?.amountInPaise || 0), 0);
            return (
              <Card key={driverId} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{data.name} — {data.phone}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{data.bookings.length} bookings • Total owed: <b style={{ color: '#EF4444' }}>{fmt(total)}</b></div>
                  </div>
                  <button onClick={() => markAllPaid(data.bookings)}
                    style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    ✅ Mark All Collected
                  </button>
                </div>
                {data.bookings.map((b) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.customerName}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{b.pickup?.address?.slice(0, 40)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(b.commission?.amountInPaise)}</div>
                      <button onClick={() => markPaid(b.id)}
                        style={{ marginTop: 4, padding: '4px 10px', backgroundColor: '#10B98115', color: '#10B981', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                        Mark Paid
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {Object.keys(byDriver).length === 0 && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2937' }}>All commissions collected!</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>No pending COD commissions</div>
        </Card>
      )}

      {/* History */}
      {collected.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 16 }}>✅ Collected History</h2>
          <Card style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                  {['Driver', 'Customer', 'Fare', 'Commission', 'Paid On'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collected.slice(0, 20).map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{b.driverName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{b.customerName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{fmt(b.fare?.totalInPaise)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10B981' }}>{fmt(b.commission?.amountInPaise)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{b.commission?.paidAt ? new Date(b.commission.paidAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}