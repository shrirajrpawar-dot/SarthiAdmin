import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge, tokens } from '../components/Card.jsx';
import { FilterBar, filterByDateRange, toDate, exportCSV } from '../components/filterUtils.jsx';

// — — Helpers — —
function displayName(driver) {
  return driver.kyc?.fullName
      || driver.name
      || driver.phone
      || `Driver-${(driver.id || '').slice(0, 6)}`
      || 'Unnamed';
}

function profileCompleteness(d) {
  const checks = [
    !!(d.kyc?.fullName || d.name),
    !!d.phone,
    !!d.email,
    !!d.kyc?.aadharNumber,
    !!d.kyc?.panNumber,
    !!d.kyc?.licenseNumber,
    !!d.vehicle?.label,
    !!d.kyc?.aadharPhoto,
    !!d.kyc?.licensePhoto,
    !!d.kyc?.bank?.accountNumber,
    !!d.kyc?.bank?.ifsc,
    !!d.kyc?.bank?.accountHolderName,
    !!d.kyc?.upiId,
  ];
  const filled = checks.filter(Boolean).length;
  return { filled, total: checks.length, pct: Math.round((filled / checks.length) * 100) };
}

const KYC_BADGE = {
  approved: { color: tokens.green, label: 'Approved' },
  verified: { color: tokens.green, label: 'Approved' },
  pending: { color: tokens.amber, label: 'Pending' },
  submitted: { color: tokens.amber, label: 'Pending' },
  under_review: { color: tokens.amber, label: 'Pending' },
  rejected: { color: tokens.red, label: 'Rejected' },
  not_started: { color: tokens.textHint, label: 'Not Started' },
};

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drivers'), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => ({
    all: drivers.length,
    online: drivers.filter((d) => d.status === 'online').length,
    offline: drivers.filter((d) => d.status !== 'online').length,
    blocked: drivers.filter((d) => d.blocked).length,
    approved: drivers.filter((d) => ['approved', 'verified'].includes(d.kyc?.status)).length,
    pending: drivers.filter((d) => ['pending', 'submitted', 'under_review'].includes(d.kyc?.status)).length,
    rejected: drivers.filter((d) => d.kyc?.status === 'rejected').length,
    not_started: drivers.filter((d) => !d.kyc?.status || d.kyc?.status === 'not_started').length,
  }), [drivers]);

  const statusOptions = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'online', label: 'Online', count: counts.online },
    { key: 'offline', label: 'Offline', count: counts.offline },
    { key: 'blocked', label: 'Blocked', count: counts.blocked },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'pending', label: 'KYC Pending', count: counts.pending },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'not_started', label: 'Incomplete', count: counts.not_started },
  ];

  // Apply all filters
  const filtered = useMemo(() => {
    let result = [...drivers];
    if (status !== 'all') {
      result = result.filter((d) => {
        if (status === 'online') return d.status === 'online';
        if (status === 'offline') return d.status !== 'online';
        if (status === 'blocked') return !!d.blocked;
        if (status === 'approved') return ['approved', 'verified'].includes(d.kyc?.status);
        if (status === 'pending') return ['pending', 'submitted', 'under_review'].includes(d.kyc?.status);
        if (status === 'rejected') return d.kyc?.status === 'rejected';
        if (status === 'not_started') return !d.kyc?.status || d.kyc?.status === 'not_started';
        return true;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        (displayName(d).toLowerCase().includes(q)) ||
        (d.phone || '').includes(q) ||
        (d.vehicle?.number || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
      );
    }
    result = filterByDateRange(result, dateRange, (d) => toDate(d.createdAt));
    return result;
  }, [drivers, status, search, dateRange]);

  const handleExport = () => {
    exportCSV('drivers', [
      { header: 'Name',         get: (d) => displayName(d) },
      { header: 'Phone',        get: (d) => d.phone || '' },
      { header: 'Email',        get: (d) => d.email || '' },
      { header: 'Status',       get: (d) => d.blocked ? 'Blocked' : d.status === 'online' ? 'Online' : 'Offline' },
      { header: 'KYC Status',   get: (d) => d.kyc?.status || 'not_started' },
      { header: 'Aadhar',       get: (d) => d.kyc?.aadharNumber || '' },
      { header: 'PAN',          get: (d) => d.kyc?.panNumber || '' },
      { header: 'License',      get: (d) => d.kyc?.licenseNumber || '' },
      { header: 'Bank Holder',  get: (d) => d.kyc?.bank?.accountHolderName || '' },
      { header: 'Bank Account', get: (d) => d.kyc?.bank?.accountNumber || '' },
      { header: 'IFSC',         get: (d) => d.kyc?.bank?.ifsc || '' },
      { header: 'UPI ID',       get: (d) => d.kyc?.upiId || '' },
      { header: 'Vehicle Type', get: (d) => d.vehicle?.label || '' },
      { header: 'Vehicle No',   get: (d) => d.vehicle?.number || '' },
      { header: 'Total Earnings ₹', get: (d) => Math.round((d.earnings?.totalInPaise || 0) / 100) },
      { header: 'Today Earnings ₹', get: (d) => Math.round((d.earnings?.todayInPaise || 0) / 100) },
      { header: 'Created',      get: (d) => toDate(d.createdAt)?.toLocaleDateString() || '' },
      { header: 'UID',          get: (d) => d.id },
    ], filtered);
  };

  const forceOffline = async (driver) => {
    if (!window.confirm(`Force ${displayName(driver)} offline?`)) return;
    await updateDoc(doc(db, 'drivers', driver.id), { status: 'offline' });
  };

  return (
    <div>
      <PageTitle title="Drivers" sub={`${drivers.length} total drivers on platform`} />

      <FilterBar
        search={search} setSearch={setSearch}
        searchPlaceholder="Search by name, phone, vehicle number, email..."
        dateRange={dateRange} setDateRange={setDateRange}
        statusOptions={statusOptions} status={status} setStatus={setStatus}
        onExport={handleExport}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: tokens.textHint, fontSize: 14 }}>
              No drivers match these filters
            </div>
          ) : (
            filtered.map((d) => {
              const isSelected = selected?.id === d.id;
              const kycInfo = KYC_BADGE[d.kyc?.status || 'not_started'] || KYC_BADGE.not_started;
              const isOnline = d.status === 'online';
              const earnings = Math.round((d.earnings?.totalInPaise || 0) / 100);
              const completeness = profileCompleteness(d);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(d)}
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
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: tokens.bgPanel,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, color: tokens.textSecondary,
                    }}>
                      {(displayName(d)[0] || '?').toUpperCase()}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 11, height: 11, borderRadius: 6,
                      backgroundColor: isOnline ? tokens.green : tokens.textHint,
                      border: '2px solid #FFFFFF',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary }}>
                      {displayName(d)}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 3 }}>
                      {d.phone || 'No phone'}
                      {d.vehicle?.label ? ` · ${d.vehicle.label}` : ''}
                      {d.vehicle?.number ? ` · ${d.vehicle.number}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 3 }}>
                      Profile {completeness.pct}% complete · ₹{earnings} earned
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={kycInfo.label} color={kycInfo.color} />
                    {isOnline && <Badge label="Online" color={tokens.green} />}
                    {d.blocked && <Badge label="🚫 Blocked" color={tokens.red} />}
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* Detail Panel */}
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
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <Badge
                    label={KYC_BADGE[selected.kyc?.status || 'not_started']?.label || 'Unknown'}
                    color={KYC_BADGE[selected.kyc?.status || 'not_started']?.color || tokens.textHint}
                  />
                  <Badge
                    label={selected.status === 'online' ? 'Online' : 'Offline'}
                    color={selected.status === 'online' ? tokens.green : tokens.textHint}
                  />
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={closeBtnStyle}
              >✕</button>
            </div>

            {/* Profile Completeness Bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Profile Completeness
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textPrimary }}>
                  {profileCompleteness(selected).pct}%
                </span>
              </div>
              <div style={{ height: 6, backgroundColor: tokens.bgPanel, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${profileCompleteness(selected).pct}%`,
                  height: '100%',
                  backgroundColor: profileCompleteness(selected).pct >= 70 ? tokens.green : profileCompleteness(selected).pct >= 40 ? tokens.amber : tokens.red,
                }} />
              </div>
            </div>

            <SectionLabel>Contact</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Phone"      value={selected.phone} mono />
              <InfoRow label="Email"      value={selected.email} />
              <InfoRow label="Joined"     value={toDate(selected.createdAt)?.toLocaleDateString() || '—'} last />
            </div>

            <SectionLabel>KYC</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Full Name"  value={selected.kyc?.fullName} />
              <InfoRow label="Aadhar"     value={selected.kyc?.aadharNumber} mono />
              <InfoRow label="PAN"        value={selected.kyc?.panNumber} mono />
              <InfoRow label="License"    value={selected.kyc?.licenseNumber} mono last />
            </div>

            <SectionLabel>Vehicle</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Type"   value={selected.vehicle?.label} />
              <InfoRow label="Model"  value={selected.vehicle?.model} />
              <InfoRow label="Number" value={selected.vehicle?.number} mono last />
            </div>

            <SectionLabel>Bank & UPI</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Holder Name"  value={selected.kyc?.bank?.accountHolderName} />
              <InfoRow label="Account No."  value={selected.kyc?.bank?.accountNumber} mono />
              <InfoRow label="IFSC"         value={selected.kyc?.bank?.ifsc} mono />
              <InfoRow label="UPI ID"       value={selected.kyc?.upiId} mono last />
            </div>

            <SectionLabel>Earnings</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Today"  value={`₹${Math.round((selected.earnings?.todayInPaise || 0) / 100)}`} valueColor={tokens.green} />
              <InfoRow label="Total"  value={`₹${Math.round((selected.earnings?.totalInPaise || 0) / 100)}`} valueColor={tokens.green} last />
            </div>

            <SectionLabel>Documents</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
              <DocThumb label="Aadhar"  uri={selected.kyc?.aadharPhoto} />
              <DocThumb label="PAN"     uri={selected.kyc?.panPhoto} />
              <DocThumb label="License" uri={selected.kyc?.licensePhoto} />
              <DocThumb label="RC"      uri={selected.kyc?.rcPhoto} />
            </div>

            {selected.kyc?.rejectionReason && (
              <div style={{
                marginTop: 8, marginBottom: 16,
                padding: 12,
                backgroundColor: tokens.redSoft,
                borderRadius: 12,
                border: `1px solid #FECACA`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: tokens.red, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  Rejection Reason
                </div>
                <div style={{ fontSize: 13, color: '#991B1B', marginTop: 4, fontWeight: 500 }}>
                  {selected.kyc.rejectionReason}
                </div>
              </div>
            )}

            {selected.status === 'online' && (
              <button
                onClick={() => forceOffline(selected)}
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
                Force Offline
              </button>
            )}

            {/* Block / Unblock Driver */}
            <button
              onClick={async () => {
                const newVal = !selected.blocked;
                if (newVal && !window.confirm(`Block ${selected.name || selected.phone || 'this driver'}? They won't be able to go online.`)) return;
                try {
                  await updateDoc(doc(db, 'drivers', selected.id), {
                    blocked: newVal,
                    ...(newVal ? { status: 'offline' } : {}),
                  });
                  setSelected((prev) => ({ ...prev, blocked: newVal, ...(newVal ? { status: 'offline' } : {}) }));
                } catch (e) {
                  alert('Error: ' + e.message);
                }
              }}
              style={{
                width: '100%',
                padding: 12,
                marginTop: 8,
                backgroundColor: selected.blocked ? '#ECFDF5' : '#FEF2F2',
                color: selected.blocked ? '#065F46' : '#991B1B',
                border: `1.5px solid ${selected.blocked ? '#A7F3D0' : '#FECACA'}`,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {selected.blocked ? '✅ Unblock Driver' : '🚫 Block Driver'}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}

// — — Subcomponents — —

const closeBtnStyle = {
  background: tokens.bgPanel,
  border: `1px solid ${tokens.border}`,
  fontSize: 14,
  cursor: 'pointer',
  color: tokens.textMuted,
  width: 30, height: 30,
  borderRadius: 8,
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
      fontSize: 11,
      fontWeight: 800,
      color: tokens.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false, last = false, valueColor }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
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

function DocThumb({ label, uri }) {
  if (!uri) {
    return (
      <div style={{
        backgroundColor: tokens.bgPanel,
        border: `1px dashed ${tokens.borderStrong}`,
        borderRadius: 12,
        padding: 14,
        textAlign: 'center',
        minHeight: 90,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 12, color: tokens.textHint, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: tokens.textHint, marginTop: 4 }}>Not uploaded</div>
      </div>
    );
  }
  return (
    <div
      style={{
        backgroundColor: tokens.bgPanel,
        border: `1px solid ${tokens.border}`,
        borderRadius: 12,
        padding: 6,
        cursor: 'pointer',
      }}
      onClick={() => window.open(uri, '_blank')}
    >
      <img src={uri} alt={label} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
      <div style={{ fontSize: 11, color: tokens.textPrimary, marginTop: 4, fontWeight: 700, textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}