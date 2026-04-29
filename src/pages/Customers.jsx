import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge, tokens } from '../components/Card.jsx';
import { FilterBar, filterByDateRange, toDate, exportCSV } from '../components/filterUtils.jsx';

function displayName(u) {
  return u.name || u.phone || u.email || `User-${(u.id || '').slice(0, 6)}` || 'Unnamed';
}

export default function Customers() {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubBookings(); };
  }, []);

  // Roll up per-customer stats
  const customers = useMemo(() => {
    const stats = {};
    bookings.forEach((b) => {
      if (!b.customerId) return;
      if (!stats[b.customerId]) stats[b.customerId] = { count: 0, spent: 0, lastDate: null };
      stats[b.customerId].count += 1;
      if (b.status === 'completed') {
        stats[b.customerId].spent += (b.fare?.totalInPaise || 0);
      }
      const d = toDate(b.createdAt);
      if (d && (!stats[b.customerId].lastDate || d > stats[b.customerId].lastDate)) {
        stats[b.customerId].lastDate = d;
      }
    });
    return users
      .filter((u) => !u.isDriver) // exclude drivers from customers list
      .map((u) => ({
        ...u,
        bookingsCount: stats[u.id]?.count || 0,
        totalSpentInPaise: stats[u.id]?.spent || 0,
        lastSeenDate: stats[u.id]?.lastDate || toDate(u.createdAt),
      }));
  }, [users, bookings]);

  const counts = useMemo(() => ({
    all: customers.length,
    active: customers.filter((c) => c.bookingsCount > 0).length,
    inactive: customers.filter((c) => c.bookingsCount === 0).length,
    blocked: customers.filter((c) => c.blocked).length,
  }), [customers]);

  const statusOptions = [
    { key: 'all',      label: 'All',      count: counts.all },
    { key: 'active',   label: 'Active',   count: counts.active },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
    { key: 'blocked',  label: 'Blocked',  count: counts.blocked },
  ];

  const filtered = useMemo(() => {
    let result = [...customers];
    if (status !== 'all') {
      result = result.filter((c) => {
        if (status === 'active')   return c.bookingsCount > 0;
        if (status === 'inactive') return c.bookingsCount === 0;
        if (status === 'blocked')  return c.blocked;
        return true;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        displayName(c).toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    }
    result = filterByDateRange(result, dateRange, (c) => toDate(c.createdAt));
    // Sort by last activity desc
    result.sort((a, b) => (b.lastSeenDate?.getTime() || 0) - (a.lastSeenDate?.getTime() || 0));
    return result;
  }, [customers, status, search, dateRange]);

  const handleExport = () => {
    exportCSV('customers', [
      { header: 'Name',          get: (c) => displayName(c) },
      { header: 'Phone',         get: (c) => c.phone || '' },
      { header: 'Email',         get: (c) => c.email || '' },
      { header: 'Bookings',      get: (c) => c.bookingsCount },
      { header: 'Total Spent ₹', get: (c) => Math.round((c.totalSpentInPaise || 0) / 100) },
      { header: 'Status',        get: (c) => c.blocked ? 'Blocked' : c.bookingsCount > 0 ? 'Active' : 'Inactive' },
      { header: 'Joined',        get: (c) => toDate(c.createdAt)?.toLocaleDateString() || '' },
      { header: 'Last Activity', get: (c) => c.lastSeenDate?.toLocaleDateString() || '' },
      { header: 'UID',           get: (c) => c.id },
    ], filtered);
  };

  const toggleBlock = async (customer) => {
    const newState = !customer.blocked;
    if (!window.confirm(`${newState ? 'Block' : 'Unblock'} ${displayName(customer)}?`)) return;
    await updateDoc(doc(db, 'users', customer.id), { blocked: newState });
  };

  const customerBookings = useMemo(() => {
    if (!selected) return [];
    return bookings
      .filter((b) => b.customerId === selected.id)
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
  }, [selected, bookings]);

  return (
    <div>
      <PageTitle title="Customers" sub={`${customers.length} total customers`} />

      <FilterBar
        search={search} setSearch={setSearch}
        searchPlaceholder="Search by name, phone, email..."
        dateRange={dateRange} setDateRange={setDateRange}
        statusOptions={statusOptions} status={status} setStatus={setStatus}
        onExport={handleExport}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 460px' : '1fr', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: tokens.textHint, fontSize: 14 }}>
              No customers match these filters
            </div>
          ) : (
            filtered.map((c) => {
              const isSelected = selected?.id === c.id;
              const totalSpent = Math.round((c.totalSpentInPaise || 0) / 100);
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
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
                  <div style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: c.blocked ? tokens.redSoft : tokens.bgPanel,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800,
                    color: c.blocked ? tokens.red : tokens.textSecondary,
                  }}>
                    {(displayName(c)[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary }}>
                        {displayName(c)}
                      </span>
                      {c.blocked && <Badge label="Blocked" color={tokens.red} />}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 3 }}>
                      {c.phone || 'No phone'}
                      {c.email ? ` · ${c.email}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 3 }}>
                      {c.bookingsCount} bookings · ₹{totalSpent} spent
                      {c.lastSeenDate ? ` · last ${c.lastSeenDate.toLocaleDateString()}` : ''}
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
                <h3 style={{ fontWeight: 800, fontSize: 17, color: tokens.textPrimary, margin: 0 }}>
                  {displayName(selected)}
                </h3>
                <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 4, fontFamily: 'monospace' }}>
                  {selected.id}
                </div>
                {selected.blocked && (
                  <div style={{ marginTop: 8 }}>
                    <Badge label="Blocked" color={tokens.red} />
                  </div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={closeBtnStyle}>✕</button>
            </div>

            <SectionLabel>Profile</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Phone"  value={selected.phone} mono />
              <InfoRow label="Email"  value={selected.email} />
              <InfoRow label="Joined" value={toDate(selected.createdAt)?.toLocaleDateString() || '—'} last />
            </div>

            <SectionLabel>Activity</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Total Bookings" value={selected.bookingsCount} valueColor={tokens.blue} />
              <InfoRow label="Total Spent" value={`₹${Math.round((selected.totalSpentInPaise || 0) / 100)}`} valueColor={tokens.green} />
              <InfoRow label="Last Activity" value={selected.lastSeenDate?.toLocaleDateString() || '—'} last />
            </div>

            {customerBookings.length > 0 && (
              <>
                <SectionLabel>Recent Bookings</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  {customerBookings.slice(0, 5).map((b) => (
                    <div key={b.id} style={{
                      padding: '10px 12px',
                      backgroundColor: tokens.bgPanel,
                      borderRadius: 10,
                      marginBottom: 6,
                      border: `1px solid ${tokens.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textPrimary, marginBottom: 3 }}>
                          {b.vehicleLabel || b.vehicleType || 'Booking'}
                          <span style={{ fontSize: 10, color: tokens.textHint, marginLeft: 6, fontFamily: 'monospace' }}>
                            #{b.id.slice(0, 6)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: tokens.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.pickup?.address?.slice(0, 40) || '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tokens.green }}>
                          ₹{Math.round((b.fare?.totalInPaise || 0) / 100)}
                        </div>
                        <div style={{ fontSize: 10, color: tokens.textHint, marginTop: 2 }}>
                          {b.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerBookings.length > 5 && (
                    <div style={{ fontSize: 11, color: tokens.textHint, textAlign: 'center', marginTop: 4 }}>
                      + {customerBookings.length - 5} more
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={() => toggleBlock(selected)}
              style={{
                width: '100%',
                padding: 12,
                backgroundColor: selected.blocked ? tokens.greenSoft : tokens.bgCard,
                color: selected.blocked ? '#065F46' : tokens.red,
                border: `1.5px solid ${selected.blocked ? '#A7F3D0' : '#FECACA'}`,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {selected.blocked ? 'Unblock Customer' : 'Block Customer'}
            </button>
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
        {value === 0 ? '0' : (value || '—')}
      </span>
    </div>
  );
}