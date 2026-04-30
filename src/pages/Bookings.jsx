import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge, tokens } from '../components/Card.jsx';
import { FilterBar, filterByDateRange, toDate, exportCSV } from '../components/filterUtils.jsx';

const STATUS_COLORS = {
  searching: tokens.blue,
  accepted: tokens.amber,
  arrived: tokens.purple,
  at_pickup: tokens.purple,
  picked_up: tokens.green,
  in_progress: tokens.green,
  reached_dropoff: tokens.green,
  at_drop: tokens.green,
  completed: tokens.textMuted,
  cancelled: tokens.red,
  cancelled_by_customer: tokens.red,
  awaiting_payment: tokens.amber,
};

const STATUS_LABELS = {
  searching: 'Finding Driver',
  accepted: 'Driver Coming',
  arrived: 'At Pickup',
  at_pickup: 'At Pickup',
  picked_up: 'In Transit',
  in_progress: 'In Transit',
  reached_dropoff: 'At Drop',
  at_drop: 'At Drop',
  awaiting_payment: 'Awaiting Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancelled_by_customer: 'Cancelled',
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      setBookings(data);
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const c = { all: bookings.length };
    bookings.forEach((b) => {
      // Group some duplicate statuses
      const key = b.status === 'arrived' ? 'at_pickup'
                : b.status === 'picked_up' ? 'in_progress'
                : b.status === 'reached_dropoff' ? 'at_drop'
                : b.status === 'cancelled_by_customer' ? 'cancelled'
                : b.status;
      c[key] = (c[key] || 0) + 1;
    });
    return c;
  }, [bookings]);

  const statusOptions = [
    { key: 'all',         label: 'All',          count: counts.all },
    { key: 'searching',   label: 'Finding',      count: counts.searching || 0 },
    { key: 'accepted',    label: 'Coming',       count: counts.accepted || 0 },
    { key: 'at_pickup',   label: 'At Pickup',    count: counts.at_pickup || 0 },
    { key: 'in_progress', label: 'In Transit',   count: counts.in_progress || 0 },
    { key: 'completed',   label: 'Completed',    count: counts.completed || 0 },
    { key: 'cancelled',   label: 'Cancelled',    count: counts.cancelled || 0 },
  ];

  const filtered = useMemo(() => {
    let result = [...bookings];
    if (status !== 'all') {
      result = result.filter((b) => {
        if (status === 'at_pickup')   return ['arrived', 'at_pickup'].includes(b.status);
        if (status === 'in_progress') return ['picked_up', 'in_progress'].includes(b.status);
        if (status === 'cancelled')   return ['cancelled', 'cancelled_by_customer'].includes(b.status);
        return b.status === status;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.driverName || '').toLowerCase().includes(q) ||
        (b.customerPhone || '').includes(q) ||
        (b.driverPhone || '').includes(q) ||
        (b.pickup?.address || '').toLowerCase().includes(q) ||
        (b.drop?.address || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().startsWith(q)
      );
    }
    result = filterByDateRange(result, dateRange, (b) => toDate(b.createdAt));
    return result;
  }, [bookings, status, search, dateRange]);

  const handleExport = () => {
    exportCSV('bookings', [
      { header: 'Booking ID',    get: (b) => b.id },
      { header: 'Status',        get: (b) => STATUS_LABELS[b.status] || b.status || '' },
      { header: 'Customer',      get: (b) => b.customerName || '' },
      { header: 'Customer Phone',get: (b) => b.customerPhone || '' },
      { header: 'Driver',        get: (b) => b.driverName || '' },
      { header: 'Driver Phone',  get: (b) => b.driverPhone || '' },
      { header: 'Vehicle',       get: (b) => b.vehicleLabel || b.vehicleType || '' },
      { header: 'Pickup',        get: (b) => b.pickup?.address || '' },
      { header: 'Drop',          get: (b) => b.drop?.address || '' },
      { header: 'Distance (km)', get: (b) => b.distanceKm || '' },
      { header: 'Total Fare ₹',  get: (b) => Math.round((b.fare?.totalInPaise || 0) / 100) },
      { header: 'Payment Method', get: (b) => paymentMethodLabel(b.paymentMethod) },
      { header: 'Payment Status', get: (b) => paymentStatusLabel(b.paymentStatus, b.paymentMethod) },
      { header: 'Created',       get: (b) => toDate(b.createdAt)?.toLocaleString() || '' },
      { header: 'Completed',     get: (b) => toDate(b.completedAt)?.toLocaleString() || '' },
    ], filtered);
  };

  const cancelBooking = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
    setSelected(null);
  };

  const fmt = (p) => `₹${Math.round((p || 0) / 100)}`;

  return (
    <div>
      <PageTitle title="Bookings" sub={`${bookings.length} total bookings`} />

      <FilterBar
        search={search} setSearch={setSearch}
        searchPlaceholder="Search by customer, driver, phone, address, booking ID..."
        dateRange={dateRange} setDateRange={setDateRange}
        statusOptions={statusOptions} status={status} setStatus={setStatus}
        onExport={handleExport}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 460px' : '1fr', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: tokens.textHint, fontSize: 14 }}>
              No bookings match these filters
            </div>
          ) : (
            filtered.map((b) => {
              const isSelected = selected?.id === b.id;
              const fare = fmt(b.fare?.totalInPaise);
              return (
                <div
                  key={b.id}
                  onClick={() => setSelected(b)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${tokens.border}`,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? tokens.bgPanel : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Badge label={STATUS_LABELS[b.status] || b.status} color={STATUS_COLORS[b.status] || tokens.textHint} />
                      <span style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
                        {b.vehicleLabel || b.vehicleType}
                      </span>
                      <PaymentBadge booking={b} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>
                      {b.customerName || 'Unknown customer'}
                      {b.driverName ? ` → ${b.driverName}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.green }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {b.pickup?.address || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: tokens.red }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {b.drop?.address || '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: tokens.green }}>{fare}</div>
                    <div style={{ fontSize: 10, color: tokens.textHint, marginTop: 4 }}>
                      {toDate(b.createdAt)?.toLocaleDateString() || ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {selected && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 16, color: tokens.textPrimary, margin: 0 }}>
                  Booking Details
                </h3>
                <div style={{ fontSize: 11, color: tokens.textHint, fontFamily: 'monospace', marginTop: 4 }}>
                  {selected.id}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Badge
                    label={STATUS_LABELS[selected.status] || selected.status}
                    color={STATUS_COLORS[selected.status] || tokens.textHint}
                  />
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={closeBtnStyle}>✕</button>
            </div>

            <SectionLabel>Customer</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Name"  value={selected.customerName} />
              <InfoRow label="Phone" value={selected.customerPhone} mono last />
            </div>

            <SectionLabel>Driver</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Name"    value={selected.driverName} />
              <InfoRow label="Phone"   value={selected.driverPhone} mono />
              <InfoRow label="Vehicle" value={`${selected.driverVehicleLabel || ''} ${selected.driverVehicleNumber || ''}`.trim() || '—'} last />
            </div>

            <SectionLabel>Route</SectionLabel>
            <div style={{
              backgroundColor: tokens.bgPanel,
              borderRadius: 12,
              padding: 14,
              border: `1px solid ${tokens.border}`,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.green, marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: tokens.textPrimary, fontWeight: 500 }}>
                  {selected.pickup?.address || '—'}
                </div>
              </div>
              <div style={{ marginLeft: 4, height: 14, width: 1, backgroundColor: tokens.borderStrong, marginTop: 4, marginBottom: 4 }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: tokens.red, marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: tokens.textPrimary, fontWeight: 500 }}>
                  {selected.drop?.address || '—'}
                </div>
              </div>
              {selected.distanceKm && (
                <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 8, fontWeight: 600 }}>
                  Distance: {selected.distanceKm} km
                </div>
              )}
            </div>

            <SectionLabel>Fare</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Base"     value={fmt(selected.fare?.baseFare)} />
              <InfoRow label="Distance" value={fmt(selected.fare?.distanceFare)} />
              {selected.fare?.pickupPremium > 0 && (
                <InfoRow label="Pickup Premium" value={fmt(selected.fare.pickupPremium)} />
              )}
              <InfoRow label="Total"    value={fmt(selected.fare?.totalInPaise)} valueColor={tokens.green} />
              <InfoRow label="Method"  value={paymentMethodLabel(selected.paymentMethod)} />
              <InfoRow label="Status"  value={paymentStatusLabel(selected.paymentStatus, selected.paymentMethod)} valueColor={paymentStatusColor(selected.paymentStatus)} last />
            </div>

            <SectionLabel>Timeline</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Created"   value={toDate(selected.createdAt)?.toLocaleString() || '—'} />
              {selected.acceptedAt && <InfoRow label="Accepted" value={toDate(selected.acceptedAt)?.toLocaleString() || '—'} />}
              {selected.completedAt && <InfoRow label="Completed" value={toDate(selected.completedAt)?.toLocaleString() || '—'} valueColor={tokens.green} last />}
              {!selected.completedAt && <InfoRow label="—" value="" last />}
            </div>

            {!['completed', 'cancelled', 'cancelled_by_customer'].includes(selected.status) && (
              <button
                onClick={() => cancelBooking(selected.id)}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor: tokens.bgCard,
                  color: tokens.red,
                  border: `1.5px solid #FECACA`,
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Force Cancel
              </button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

const closeBtnStyle = {
  background: tokens.bgPanel,
  border: `1px solid ${tokens.border}`,
  fontSize: 14, cursor: 'pointer',
  color: tokens.textMuted,
  width: 30, height: 30, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const infoBlockStyle = {
  backgroundColor: tokens.bgPanel,
  borderRadius: 12,
  border: `1px solid ${tokens.border}`,
  marginBottom: 16,
};

// — — Payment helpers — —
function paymentMethodLabel(m) {
  if (m === 'cod') return 'Cash';
  if (m === 'upi_direct' || m === 'upi') return 'UPI to Driver';
  if (m === 'razorpay') return 'Razorpay';
  return m || '—';
}
function paymentStatusLabel(status, method) {
  if (method === 'cod' && status !== 'driver_confirmed') return 'Pending (Cash)';
  if (status === 'driver_confirmed') return '✓ Paid';
  if (status === 'customer_paid') return 'Customer Paid (awaiting driver)';
  if (status === 'pending') return 'Pending';
  return status || '—';
}
function paymentStatusColor(status) {
  if (status === 'driver_confirmed') return tokens.green;
  if (status === 'customer_paid') return tokens.amber;
  return tokens.textMuted;
}
function PaymentBadge({ booking }) {
  const m = booking.paymentMethod;
  const s = booking.paymentStatus;
  if (s === 'driver_confirmed') {
    return <Badge label="✓ Paid" color={tokens.green} />;
  }
  if (m === 'cod') return <Badge label="💵 COD" color={tokens.amber} />;
  if (m === 'upi_direct' || m === 'upi') return <Badge label="💳 UPI" color={tokens.blue} />;
  if (m === 'razorpay') return <Badge label="💳 Razorpay" color={tokens.purple || tokens.blue} />;
  return null;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: tokens.textMuted,
      letterSpacing: 0.5, textTransform: 'uppercase',
      marginBottom: 8, marginTop: 4,
    }}>{children}</div>
  );
}

function InfoRow({ label, value, mono = false, last = false, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 12px',
      borderBottom: last ? 'none' : `1px solid ${tokens.border}`,
      gap: 12,
    }}>
      <span style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 700 }}>{label}</span>
      <span style={{
        fontSize: 13,
        color: valueColor || tokens.textPrimary,
        fontWeight: 700,
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}