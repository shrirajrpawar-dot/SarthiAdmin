import React, { useEffect, useState, useMemo } from 'react';
import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import Card from '../components/Card';

const tokens = {
  bgPanel: '#F3F4F6',
  bgCard: '#FFFFFF',
  border: '#E5E7EB',
  textMuted: '#9CA3AF',
  amber: '#D97706',
  red: '#DC2626',
  green: '#059669',
};

export default function Commission() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [commissionsMap, setCommissionsMap] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchPhone, setSearchPhone] = useState('');
  const [settling, setSettling] = useState(false);
  const [maxOwedRupees] = useState(500);

  // Fetch all drivers
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, 'drivers'), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user?.uid]);

  // Fetch commission aggregates + pending verifications
  useEffect(() => {
    if (!user?.uid || drivers.length === 0) return;
    
    const fetchCommissions = async () => {
      const newMap = {};
      const pendingVerif = [];
      
      for (const driver of drivers) {
        // Pending commissions
        const qPending = query(
          collection(db, 'bookings'),
          where('driverId', '==', driver.id),
          where('commission.status', '==', 'pending_from_driver')
        );
        const snapPending = await getDocs(qPending);
        const pendingPaise = snapPending.docs.reduce((sum, d) => sum + (d.data().commission?.amountInPaise || 0), 0);

        // Collected commissions
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

  const filtered = useMemo(() => {
    return drivers
      .filter(d => {
        const commission = commissionsMap[d.id];
        if (!commission) return false;
        
        if (filterStatus === 'pending' && commission.totalPending === 0) return false;
        if (filterStatus === 'high-risk' && commission.totalPending <= maxOwedRupees) return false;
        if (filterStatus === 'awaiting-verification' && !d.commissionPaymentClaimedAt) return false;
        
        if (searchPhone && !d.phone?.includes(searchPhone)) return false;
        return true;
      })
      .sort((a, b) => {
        const aComm = commissionsMap[a.id]?.totalPending || 0;
        const bComm = commissionsMap[b.id]?.totalPending || 0;
        return bComm - aComm;
      });
  }, [drivers, commissionsMap, filterStatus, searchPhone]);

  const settlePendingCommission = async (driverId) => {
    if (!window.confirm(`Mark all pending commission for ${selected?.name || driverId} as settled?`)) return;
    setSettling(true);
    try {
      const q = query(
        collection(db, 'bookings'),
        where('driverId', '==', driverId),
        where('commission.status', '==', 'pending_from_driver')
      );
      const snap = await getDocs(q);

      const batch = writeBatch(db);
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { 
          'commission.status': 'settled', 
          'commission.settledAt': new Date().toISOString() 
        });
      });
      
      batch.update(doc(db, 'drivers', driverId), {
        commissionPaymentClaimedAt: null,
      });
      
      await batch.commit();

      setCommissionsMap(prev => ({
        ...prev,
        [driverId]: { ...prev[driverId], pending: 0, totalPending: 0, pendingCount: 0 }
      }));
      
      setPendingPayments(prev => prev.filter(p => p.driverId !== driverId));

      alert(`✅ Marked ${snap.size} bookings as settled. Driver automatically unblocked.`);
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
      </div>

      {/* Pending Verification Section */}
      {pendingPayments.length > 0 && (
        <Card style={{ marginBottom: 20, backgroundColor: '#FFFAED', borderLeft: `4px solid ${tokens.amber}` }}>
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
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${tokens.border}` }}
          >
            <option value="all">All Drivers</option>
            <option value="awaiting-verification">Awaiting Verification ({pendingPayments.length})</option>
            <option value="pending">Has Dues</option>
            <option value="high-risk">High Risk (exceeds ₹{maxOwedRupees})</option>
          </select>
          
          <input
            placeholder="Search by phone..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${tokens.border}`, flex: 1 }}
          />
        </div>
      </Card>

      {/* Drivers List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>
          No drivers match the filter
        </div>
      ) : (
        <Card>
          {filtered.map(driver => {
            const comm = commissionsMap[driver.id] || {};
            return (
              <div
                key={driver.id}
                style={{
                  padding: 16,
                  borderBottom: `1px solid ${tokens.border}`,
                  cursor: 'pointer',
                  backgroundColor: comm.totalPending > maxOwedRupees ? '#FEF2F2' : '#FFFFFF',
                }}
                onClick={() => setSelected(driver)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{driver.name}</div>
                    <div style={{ fontSize: 12, color: tokens.textMuted }}>
                      {driver.phone}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: comm.totalPending > maxOwedRupees ? tokens.red : tokens.amber }}>
                      ₹{comm.totalPending}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textMuted }}>
                      {comm.pendingCount} booking{comm.pendingCount > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Detail Panel */}
      {selected && (
        <Card style={{ marginTop: 20, borderLeft: `4px solid ${tokens.red}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, marginBottom: 8 }}>{selected.name}</h3>
              <div style={{ fontSize: 13, color: tokens.textMuted }}>{selected.phone}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ backgroundColor: tokens.bgPanel, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600, marginBottom: 4 }}>Total Pending Due</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: tokens.red }}>
              ₹{commissionsMap[selected.id]?.totalPending || 0}
            </div>
          </div>

          {commissionsMap[selected.id]?.totalPending > 0 && (
            <button
              onClick={() => settlePendingCommission(selected.id)}
              disabled={settling}
              style={{
                padding: '12px 20px',
                backgroundColor: tokens.green,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontWeight: 800,
                cursor: settling ? 'not-allowed' : 'pointer',
                width: '100%',
                opacity: settling ? 0.6 : 1,
              }}
            >
              {settling ? 'Settling...' : '✓ Verify & Settle All'}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}