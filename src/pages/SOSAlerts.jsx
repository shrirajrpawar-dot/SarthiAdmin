import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../components/Card';

const tokens = {
  bgPanel: '#F3F4F6',
  bgCard: '#FFFFFF',
  border: '#E5E7EB',
  textMuted: '#9CA3AF',
  red: '#DC2626',
  green: '#059669',
};

export default function SOSAlerts() {
  const { user } = useAuth();
  const [sosAlerts, setSosAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('active'); // active, all
  const [selected, setSelected] = useState(null);

  // Fetch all SOS alerts
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    const sosQuery = filterStatus === 'active'
      ? query(
          collection(db, 'sos'),
          where('status', '==', 'active'),
          orderBy('triggeredAt', 'desc')
        )
      : query(
          collection(db, 'sos'),
          orderBy('triggeredAt', 'desc')
        );

    const unsub = onSnapshot(sosQuery, (snap) => {
      setSosAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid, filterStatus]);

  const markResolved = async (sosId) => {
    if (!window.confirm('Mark this SOS as resolved?')) return;
    try {
      await updateDoc(doc(db, 'sos', sosId), {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.uid,
      });
      alert('SOS marked as resolved');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const getSOSStats = useMemo(() => {
    return {
      active: sosAlerts.filter(s => s.status === 'active').length,
      driver: sosAlerts.filter(s => s.type === 'driver').length,
      support: sosAlerts.filter(s => s.type === 'support').length,
      police: sosAlerts.filter(s => s.type === 'police').length,
    };
  }, [sosAlerts]);

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h1>🚨 SOS Alerts Dashboard</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Active SOS Alerts
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tokens.red, marginTop: 8 }}>
            {getSOSStats.active}
          </div>
          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
            Require immediate action
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Type Breakdown
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              🚗 Driver: <strong>{getSOSStats.driver}</strong>
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              📞 Support: <strong>{getSOSStats.support}</strong>
            </div>
            <div style={{ fontSize: 13 }}>
              🚔 Police: <strong>{getSOSStats.police}</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setFilterStatus('active')}
            style={{
              padding: '8px 16px',
              backgroundColor: filterStatus === 'active' ? tokens.red : tokens.bgPanel,
              color: filterStatus === 'active' ? '#FFFFFF' : '#111827',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Active Alerts ({getSOSStats.active})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '8px 16px',
              backgroundColor: filterStatus === 'all' ? tokens.red : tokens.bgPanel,
              color: filterStatus === 'all' ? '#FFFFFF' : '#111827',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All SOS ({sosAlerts.length})
          </button>
        </div>
      </Card>

      {/* Alerts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>Loading...</div>
      ) : sosAlerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: tokens.textMuted }}>
          No SOS alerts at the moment
        </div>
      ) : (
        <Card>
          {sosAlerts.map(sos => (
            <div
              key={sos.id}
              style={{
                padding: 16,
                borderBottom: `1px solid ${tokens.border}`,
                cursor: 'pointer',
                backgroundColor: sos.status === 'active' ? '#FEF2F2' : '#FFFFFF',
              }}
              onClick={() => setSelected(sos)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {sos.type === 'driver' && '🚗'}
                    {sos.type === 'support' && '📞'}
                    {sos.type === 'police' && '🚔'}
                    {' '} {sos.customerName}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                    {sos.customerPhone}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    backgroundColor: sos.status === 'active' ? tokens.red : tokens.green,
                    color: '#FFFFFF',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {sos.status === 'active' ? '🚨 Active' : '✓ Resolved'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: tokens.textMuted }}>
                📍 {sos.pickupLocation?.address || 'Unknown location'}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
                {new Date(sos.triggeredAt?.toDate?.() || sos.triggeredAt).toLocaleString()}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Detail Panel */}
      {selected && (
        <Card style={{ marginTop: 20, borderLeft: `4px solid ${tokens.red}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>
                {selected.type === 'driver' && '🚗'}
                {selected.type === 'support' && '📞'}
                {selected.type === 'police' && '🚔'}
                {' '} {selected.customerName}
              </h3>
              <div style={{ fontSize: 13, color: tokens.textMuted }}>
                {selected.customerPhone}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Alert Type</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                {selected.type === 'driver' && 'Driver SOS'}
                {selected.type === 'support' && 'Support SOS'}
                {selected.type === 'police' && 'Police SOS'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: selected.status === 'active' ? tokens.red : tokens.green }}>
                {selected.status === 'active' ? '🚨 Active' : '✓ Resolved'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600 }}>Time</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                {new Date(selected.triggeredAt?.toDate?.() || selected.triggeredAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: tokens.bgPanel, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600, marginBottom: 4 }}>Location</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              📍 {selected.pickupLocation?.address || 'Unknown'}
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
              Lat: {selected.pickupLocation?.lat?.toFixed(4)}, Lng: {selected.pickupLocation?.lng?.toFixed(4)}
            </div>
          </div>

          {selected.bookingId && (
            <div style={{ backgroundColor: tokens.bgPanel, padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600, marginBottom: 4 }}>Booking ID</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.bookingId}</div>
            </div>
          )}

          {selected.status === 'active' && (
            <button
              onClick={() => markResolved(selected.id)}
              style={{
                padding: '12px 20px',
                backgroundColor: tokens.green,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontWeight: 800,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              ✓ Mark as Resolved
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
