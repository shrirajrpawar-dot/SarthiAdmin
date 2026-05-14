import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../components/Card';
import { filterUtils } from '../components/filterUtils';

const { Badge, Input, Select } = filterUtils;

// Design tokens
const tokens = {
  bgPanel: '#F3F4F6',
  bgCard: '#FFFFFF',
  border: '#E5E7EB',
  textMuted: '#9CA3AF',
  red: '#DC2626',
  amber: '#D97706',
  green: '#059669',
};

export default function Settlements() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [commissionsMap, setCommissionsMap] = useState({}); // driverId -> { pending, collected, totalPending }
  const [pendingPayments, setPendingPayments] = useState([]); // Drivers who claimed payment but not yet settled
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, high-risk, awaiting-verification
  const [searchPhone, setSearchPhone] = useState('');
  const [settling, setSettling] = useState(false);

  // Fetch all drivers
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, 'drivers'), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user?.uid]);

  // Fetch commission aggregates for each driver + pending verifications
  useEffect(() => {
    if (!user?.uid || drivers.length === 0) return;
    
    const fetchCommissions = async () => {
      const newMap = {};
      const pendingVerif = [];
      
      for (const driver of drivers) {
        // Pending commission (not yet paid)
        const qPending = query(
          collection(db, 'bookings'),
          where('driverId', '==', driver.id),
          where('commission.status', '==', 'pending_from_driver')
        );
        const snapPending = await getDocs(qPending);
        const pendingPaise = snapPending.docs.reduce((sum, d) => sum + (d.data().commission?.amountInPaise || 0), 0);

        // Collected commission (already paid by driver)
        const qCollected = query(
          collection(db, 'bookings'),
          where('driverId', '==', driver.id),
          where('commission.status', '==', 'collected')
        );
        const snapCollected = await getDocs(qCollected);
        const collectedPaise = snapCollected.docs.reduce((sum, d) => sum + (d.data().commission?.amountInPaise || 0), 0);

        newMap[driver.id] = {
          pending: Math.round(pendingPaise / 100),
          collected: Math.round(collectedPaise / 100),
          totalPending: Math.round(pendingPaise / 100),
          pendingCount: snapPending.size,
        };

        // Track drivers with pending payment verification
        if (driver.commissionPaymentClaimedAt && Math.round(pendingPaise / 100) > 0) {
          const claimedTime = new Date(driver.commissionPaymentClaimedAt).getTime();
          const nowTime = Date.now();
          const minutesAgo = Math.round((nowTime - claimedTime) / 60000);
          
          pendingVerif.push({
            driverId: driver.id,
            driverName: driver.name || 'Unknown',
            driverPhone: driver.phone,
            claimedAmount: driver.commissionPaymentAmount,
            claimedAt: driver.commissionPaymentClaimedAt,
            minutesAgo,
            pendingBookings: snapPending.docs.map(d => ({ id: d.id, ...d.data() })),
          });
        }
      }
      
      setCommissionsMap(newMap);
      setPendingPayments(pendingVerif);
      setLoading(false);
    };

    fetchCommissions();
  }, [drivers]);

  const maxOwedRupees = 500; // Fetch from settings if needed

  const filtered = useMemo(() => {
    return drivers
      .filter(d => {
        const commission = commissionsMap[d.id];
        if (!commission) return false;
        
        // Filter by status
        if (filterStatus === 'pending' && commission.totalPending === 0) return false;
        if (filterStatus === 'high-risk' && commission.totalPending <= maxOwedRupees) return false;
        if (filterStatus === 'awaiting-verification' && !d.commissionPaymentClaimedAt) return false;
        
        // Search by phone
        if (searchPhone && !d.phone?.includes(searchPhone)) return false;
        return true;
      })
      .sort((a, b) => {
        const aComm = commissionsMap[a.id]?.totalPending || 0;
        const bComm = commissionsMap[b.id]?.totalPending || 0;
        return bComm - aComm; // Highest dues first
      });
  }, [drivers, commissionsMap, filterStatus, searchPhone]);

  const settlePendingCommission = async (driverId) => {
    if (!window.confirm(`Mark all pending commission for ${selected?.name || driverId} as settled?`)) return;
    setSettling(true);
    try {
      // Get all pending bookings
      const q = query(
        collection(db, 'bookings'),
        where('driverId', '==', driverId),
        where('commission.status', '==', 'pending_from_driver')
      );
      const snap = await getDocs(q);

      // Batch update — mark all as 'settled'
      const batch = writeBatch(db);
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { 'commission.status': 'settled', 'commission.settledAt': new Date().toISOString() });
      });
      
      // Clear the payment claimed flag
      batch.update(doc(db, 'drivers', driverId), {
        commissionPaymentClaimedAt: null,
      });
      
      await batch.commit();

      // Update local state
      setCommissionsMap(prev => ({
        ...prev,
        [driverId]: { ...prev[driverId], pending: 0, totalPending: 0, pendingCount: 0 }
      }));
      
      // Remove from pending payments
      setPendingPayments(prev => prev.filter(p => p.driverId !== driverId));

      alert(`✅ Marked ${snap.size} bookings as settled for ${selected?.name || driverId}. Driver automatically unblocked.`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSettling(false);
    }
  };

  const settlementStats = useMemo(() => {
    const allCommissions = Object.values(commissionsMap);
    return {
      totalPending: allCommissions.reduce((sum, c) => sum + c.totalPending, 0),
      drivesWithDues: allCommissions.filter(c => c.totalPending > 0).length,
      highRisk: allCommissions.filter(c => c.totalPending > maxOwedRupees).length,
    };
  }, [commissionsMap]);

  if (!user) return <div>Not logged in</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h1>💰 Commission Settlements</h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Total Pending</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tokens.red, marginTop: 8 }}>
            ₹{settlementStats.totalPending.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
            From {settlementStats.drivesWithDues} drivers
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>High Risk (exceeds ₹{maxOwedRupees})</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tokens.amber, marginTop: 8 }}>
            {settlementStats.highRisk}
          </div>
          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
            Drivers must pay before going online
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Max Limit</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tokens.green, marginTop: 8 }}>
            ₹{maxOwedRupees}
          </div>
          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
            Per driver threshold
          </div>
        </Card>
      </div>

      {/* Pending Verification Section */}
      {pendingPayments.length > 0 && (
        <Card style={{ marginBottom: 20, backgroundColor: '#FFFAED', borderLeft: '4px solid #D97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#92400E' }}>
              ⏳ {pendingPayments.length} Driver{pendingPayments.length > 1 ? 's' : ''} Awaiting Verification
            </h3>
            <span style={{ fontSize: 11, color: tokens.textMuted }}>Claimed payment but not yet settled</span>
          </div>
          
          {pendingPayments.map(payment => (
            <div 
              key={payment.driverId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
                backgroundColor: '#FFFFFF',
                borderRadius: 6,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{payment.driverName}</div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>
                  {payment.driverPhone} · Claimed {payment.minutesAgo} min ago
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: tokens.amber }}>
                    ₹{payment.claimedAmount}
                  </div>
                  <div style={{ fontSize: 10, color: tokens.textMuted }}>
                    {payment.pendingBookings.length} booking{payment.pendingBookings.length > 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelected(drivers.find(d => d.id === payment.driverId));
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: tokens.amber,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Verify & Settle
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${tokens.border}` }}
          >
            <option value="all">All Drivers</option>
            <option value="awaiting-verification">Awaiting Verification ({pendingPayments.length})</option>
            <option value="pending">Has Dues</option>
            <option value="high-risk">High Risk (exceeds ₹{maxOwedRupees})</option>
          </Select>
          
          <Input
            placeholder="Search by phone..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${tokens.border}`, flex: 1, maxWidth: 250 }}
          />

          <div style={{ fontSize: 12, color: tokens.textMuted }}>
            {filtered.length} drivers
          </div>
        </div>
      </Card>

      {/* Drivers table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>No drivers to show</div>
      ) : (
        <Card style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                <th style={thStyle}>Driver</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Pending Dues</th>
                <th style={thStyle}>Bookings</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(driver => {
                const comm = commissionsMap[driver.id] || {};
                const isHighRisk = comm.totalPending > maxOwedRupees;
                const canPay = comm.totalPending > 0;

                return (
                  <tr key={driver.id} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{driver.name || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: tokens.textMuted }}>{driver.id.slice(0, 8)}</div>
                    </td>
                    <td style={tdStyle}>{driver.phone}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: isHighRisk ? tokens.red : tokens.amber }}>
                        ₹{comm.totalPending?.toLocaleString() || 0}
                      </div>
                    </td>
                    <td style={tdStyle}>{comm.pendingCount || 0}</td>
                    <td style={tdStyle}>
                      {!canPay ? (
                        <Badge label="No Dues" color={tokens.green} />
                      ) : isHighRisk ? (
                        <Badge label="🚫 Blocked" color={tokens.red} />
                      ) : (
                        <Badge label="⚠️ Warning" color={tokens.amber} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setSelected(driver)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: tokens.bgPanel,
                          border: `1px solid ${tokens.border}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detail panel */}
      {selected && commissionsMap[selected.id] && (
        <Card style={{ marginTop: 20, backgroundColor: '#FEF3C7', borderLeft: `4px solid ${tokens.amber}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>{selected.name}</h3>
              <div style={{ fontSize: 13, color: tokens.textMuted }}>
                {selected.phone} · {selected.id.slice(0, 8)}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: tokens.textMuted,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Pending Amount</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: tokens.red, marginTop: 4 }}>
                ₹{commissionsMap[selected.id].totalPending}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Bookings</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: tokens.amber, marginTop: 4 }}>
                {commissionsMap[selected.id].pendingCount}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Status</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: tokens.amber, marginTop: 4 }}>
                {commissionsMap[selected.id].totalPending > maxOwedRupees ? '🚫 Blocked' : '⚠️ Warning'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid #FDE68A`, paddingTop: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, margin: '0 0 8px 0', color: '#78350F' }}>
              ✓ Verify payment received from driver ({commissionsMap[selected.id].totalPending > maxOwedRupees ? 'URGENT' : 'pending'}), then:
            </p>
          </div>

          <button
            onClick={() => settlePendingCommission(selected.id)}
            disabled={settling || commissionsMap[selected.id].totalPending === 0}
            style={{
              padding: '12px 20px',
              backgroundColor: commissionsMap[selected.id].totalPending === 0 ? '#E5E7EB' : '#10B981',
              color: commissionsMap[selected.id].totalPending === 0 ? '#9CA3AF' : '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 14,
              cursor: commissionsMap[selected.id].totalPending === 0 ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {settling ? 'Processing...' : `✅ Mark ₹${commissionsMap[selected.id].totalPending} as Settled (${commissionsMap[selected.id].pendingCount} bookings)`}
          </button>

          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 8, textAlign: 'center' }}>
            This will mark all {commissionsMap[selected.id].pendingCount} pending bookings as settled. Driver can go online again.
          </div>
        </Card>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 700,
  color: tokens.textMuted,
  backgroundColor: '#FAFAFA',
};

const tdStyle = {
  padding: '14px 16px',
  fontSize: 13,
  borderBottom: `1px solid ${tokens.border}`,
};