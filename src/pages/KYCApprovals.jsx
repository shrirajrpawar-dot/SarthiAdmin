import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge, tokens } from '../components/Card.jsx';

export default function KYCApprovals() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drivers'), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = drivers.filter((d) => {
    const status = d.kyc?.status || 'not_started';
    if (filter === 'all') return true;
    return status === filter;
  });

  const approve = async (driverId) => {
    setLoading(true);
    await updateDoc(doc(db, 'drivers', driverId), {
      'kyc.status': 'approved',
      'kyc.approvedAt': new Date().toISOString(),
    });
    setSelected(null);
    setLoading(false);
  };

  const reject = async (driverId) => {
    if (!rejectReason.trim()) {
      alert('Enter rejection reason');
      return;
    }
    setLoading(true);
    await updateDoc(doc(db, 'drivers', driverId), {
      'kyc.status': 'rejected',
      'kyc.rejectionReason': rejectReason,
      'kyc.rejectedAt': new Date().toISOString(),
    });
    setSelected(null);
    setRejectReason('');
    setLoading(false);
  };

  const badgeColor = {
    pending: tokens.amber,
    approved: tokens.green,
    rejected: tokens.red,
    not_started: tokens.textHint,
  };

  const statusLabel = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    not_started: 'Not Started',
  };

  const counts = {
    pending: drivers.filter((d) => d.kyc?.status === 'pending').length,
    approved: drivers.filter((d) => d.kyc?.status === 'approved').length,
    rejected: drivers.filter((d) => d.kyc?.status === 'rejected').length,
  };

  const tabs = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'all', label: 'All', count: drivers.length },
  ];

  return (
    <div>
      <PageTitle title="KYC Approvals" sub="Review and verify driver documents" />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: `1px solid ${active ? tokens.dark : tokens.border}`,
                backgroundColor: active ? tokens.dark : tokens.bgCard,
                color: active ? '#FFFFFF' : tokens.textSecondary,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s',
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                backgroundColor: active ? '#FFFFFF20' : tokens.bgPanel,
                color: active ? '#FFFFFF' : tokens.textMuted,
                padding: '1px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
              }}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 440px' : '1fr', gap: 16 }}>
        {/* List */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: tokens.textHint, fontSize: 14 }}>
              No {filter === 'all' ? '' : filter} KYC applications
            </div>
          ) : (
            filtered.map((driver) => {
              const isSelected = selected?.id === driver.id;
              const status = driver.kyc?.status || 'not_started';
              return (
                <div
                  key={driver.id}
                  onClick={() => setSelected(driver)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${tokens.border}`,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? tokens.bgPanel : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'background-color 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary }}>
                      {driver.kyc?.fullName || driver.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 3 }}>
                      {driver.phone} · {driver.vehicle?.label || 'No vehicle'}
                      {driver.vehicle?.model ? ` · ${driver.vehicle.model}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 3 }}>
                      {driver.kyc?.submittedAt
                        ? `Submitted ${new Date(driver.kyc.submittedAt).toLocaleDateString()}`
                        : 'Not submitted yet'}
                    </div>
                  </div>
                  <Badge label={statusLabel[status] || status} color={badgeColor[status]} />
                </div>
              );
            })
          )}
        </Card>

        {/* Detail Panel */}
        {selected && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 17, color: tokens.textPrimary, margin: 0 }}>
                  {selected.kyc?.fullName || 'Driver Details'}
                </h3>
                <div style={{ marginTop: 6 }}>
                  <Badge
                    label={statusLabel[selected.kyc?.status || 'not_started']}
                    color={badgeColor[selected.kyc?.status || 'not_started']}
                  />
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: tokens.bgPanel,
                  border: `1px solid ${tokens.border}`,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: tokens.textMuted,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <SectionLabel>Personal Information</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Phone" value={selected.phone} />
              <InfoRow label="Aadhar" value={selected.kyc?.aadharNumber} mono />
              <InfoRow label="PAN" value={selected.kyc?.panNumber} mono />
              <InfoRow label="License" value={selected.kyc?.licenseNumber} mono last />
            </div>

            <SectionLabel>Vehicle</SectionLabel>
            <div style={infoBlockStyle}>
              <InfoRow label="Type" value={selected.vehicle?.label} />
              <InfoRow label="Model" value={selected.vehicle?.model} />
              <InfoRow label="Number" value={selected.vehicle?.number} mono last />
            </div>

            <SectionLabel>Documents</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
              <DocThumb label="Aadhar Card" uri={selected.kyc?.aadharPhoto} />
              <DocThumb label="PAN Card" uri={selected.kyc?.panPhoto} />
              <DocThumb label="Driving License" uri={selected.kyc?.licensePhoto} />
              <DocThumb label="Vehicle RC" uri={selected.kyc?.rcPhoto} />
            </div>

            {/* Rejection reason */}
            {selected.kyc?.rejectionReason && (
              <div style={{
                marginTop: 16,
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

            {/* Actions */}
            {selected.kyc?.status === 'pending' && (
              <div style={{ marginTop: 18 }}>
                <button
                  onClick={() => approve(selected.id)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    backgroundColor: tokens.green,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginBottom: 12,
                  }}
                >
                  Approve KYC
                </button>
                <textarea
                  placeholder="Reason for rejection (required to reject)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${tokens.border}`,
                    backgroundColor: tokens.bgPanel,
                    fontSize: 13,
                    resize: 'vertical',
                    minHeight: 70,
                    fontFamily: 'inherit',
                    color: tokens.textPrimary,
                  }}
                />
                <button
                  onClick={() => reject(selected.id)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '12px',
                    backgroundColor: tokens.bgCard,
                    color: tokens.red,
                    border: `1.5px solid #FECACA`,
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Reject KYC
                </button>
              </div>
            )}

            {selected.kyc?.status === 'approved' && (
              <div style={{
                marginTop: 18,
                padding: 14,
                backgroundColor: tokens.greenSoft,
                borderRadius: 12,
                border: `1px solid #A7F3D0`,
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 800, color: '#065F46', fontSize: 14 }}>KYC Approved</div>
                {selected.kyc?.approvedAt && (
                  <div style={{ fontSize: 12, color: '#047857', marginTop: 4, fontWeight: 600 }}>
                    on {new Date(selected.kyc.approvedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

const infoBlockStyle = {
  backgroundColor: tokens.bgPanel,
  borderRadius: 12,
  padding: 4,
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

function InfoRow({ label, value, mono = false, last = false }) {
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
        color: tokens.textPrimary,
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
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 13, color: tokens.textHint, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 4 }}>Not uploaded</div>
      </div>
    );
  }
  return (
    <div style={{
      backgroundColor: tokens.bgPanel,
      border: `1px solid ${tokens.border}`,
      borderRadius: 12,
      padding: 8,
      cursor: 'pointer',
    }} onClick={() => window.open(uri, '_blank')}>
      <img
        src={uri}
        alt={label}
        style={{
          width: '100%',
          height: 88,
          objectFit: 'cover',
          borderRadius: 8,
        }}
      />
      <div style={{
        fontSize: 12,
        color: tokens.textPrimary,
        marginTop: 6,
        fontWeight: 700,
        textAlign: 'center',
      }}>
        {label}
      </div>
    </div>
  );
}