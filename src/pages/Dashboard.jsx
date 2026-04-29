import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { StatCard, PageTitle, Card, Badge, tokens } from '../components/Card.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState({
    bookings: 0, drivers: 0, customers: 0, revenue: 0,
    pendingKyc: 0, pendingCommission: 0, searching: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, 'bookings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const revenue = data.filter((b) => b.status === 'completed').reduce((s, b) => s + (b.fare?.totalInPaise || 0), 0);
      const pendingComm = data.filter((b) => b.commission?.status === 'pending_from_driver').reduce((s, b) => s + (b.commission?.amountInPaise || 0), 0);
      const searching = data.filter((b) => b.status === 'searching').length;
      const sorted = [...data].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecentBookings(sorted.slice(0, 5));
      setStats((prev) => ({ ...prev, bookings: data.length, revenue, pendingCommission: pendingComm, searching }));
    }));

    unsubs.push(onSnapshot(collection(db, 'drivers'), (snap) => {
      const pending = snap.docs.filter((d) => d.data().kyc?.status === 'pending').length;
      setStats((prev) => ({ ...prev, drivers: snap.size, pendingKyc: pending }));
    }));

    unsubs.push(onSnapshot(collection(db, 'users'), (snap) => {
      const customers = snap.docs.filter((d) => !d.data().isDriver).length;
      setStats((prev) => ({ ...prev, customers }));
    }));

    return () => unsubs.forEach((u) => u());
  }, []);

  const statusColor = {
    searching: tokens.blue,
    accepted: tokens.amber,
    at_pickup: tokens.purple,
    in_progress: tokens.green,
    at_drop: tokens.green,
    completed: tokens.textMuted,
    cancelled: tokens.red,
  };
  const statusLabel = {
    searching: 'Finding Driver',
    accepted: 'Driver Coming',
    at_pickup: 'At Pickup',
    in_progress: 'In Progress',
    at_drop: 'At Drop',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <div>
      <PageTitle title="Dashboard" sub="Real-time overview of Sarthi platform" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        <StatCard icon="📦" label="Total Bookings" value={stats.bookings} color={tokens.blue} />
        <StatCard icon="🔍" label="Active Searches" value={stats.searching} color={tokens.amber} sub="Waiting for driver" />
        <StatCard icon="🚗" label="Total Drivers" value={stats.drivers} color={tokens.green} />
        <StatCard icon="👥" label="Customers" value={stats.customers} color={tokens.purple} />
        <StatCard icon="💰" label="Total Revenue" value={`₹${Math.round(stats.revenue / 100)}`} color={tokens.green} />
        <StatCard icon="📋" label="Pending KYC" value={stats.pendingKyc} color={tokens.amber} sub="Need review" />
        <StatCard icon="⚠" label="COD Commission" value={`₹${Math.round(stats.pendingCommission / 100)}`} color={tokens.red} sub="Pending from drivers" />
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
            Recent Bookings
          </h2>
          <span style={{ fontSize: 12, color: tokens.textHint, fontWeight: 600 }}>
            Latest 5
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.borderStrong}` }}>
                {['Customer', 'Vehicle', 'Pickup', 'Drop', 'Fare', 'Payment', 'Status'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 800,
                    color: tokens.textMuted,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>
                    {b.customerName}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: tokens.textSecondary }}>
                    {b.vehicleLabel}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: tokens.textMuted, maxWidth: 180 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.pickup?.address}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: tokens.textMuted, maxWidth: 180 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.drop?.address}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, color: tokens.green }}>
                    ₹{Math.round((b.fare?.totalInPaise || 0) / 100)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12 }}>
                    <Badge
                      label={b.paymentMethod === 'cod' ? 'COD' : 'UPI'}
                      color={b.paymentMethod === 'cod' ? tokens.amber : tokens.blue}
                    />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Badge
                      label={statusLabel[b.status] || b.status}
                      color={statusColor[b.status] || tokens.textHint}
                    />
                  </td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: tokens.textHint, fontSize: 14 }}>
                    No bookings yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}