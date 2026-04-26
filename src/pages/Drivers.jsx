import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card, Badge } from '../components/Card.jsx';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drivers'), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = drivers.filter((d) =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search)
  );

  const toggleBlock = async (driver) => {
    if (!confirm(`${driver.blocked ? 'Unblock' : 'Block'} this driver?`)) return;
    await updateDoc(doc(db, 'drivers', driver.id), { blocked: !driver.blocked });
  };

  const kycColor = { approved: '#10B981', pending: '#F59E0B', rejected: '#EF4444', not_started: '#9CA3AF' };

  return (
    <div>
      <PageTitle title="🚗 Drivers" sub="Manage all registered drivers" />
      <input placeholder="🔍 Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, marginBottom: 20, outline: 'none' }} />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>
        <Card style={{ padding: 0 }}>
          {filtered.map((driver) => (
            <div key={driver.id} onClick={() => setSelected(driver)}
              style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, backgroundColor: selected?.id === driver.id ? '#10B98108' : 'transparent' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B98120', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1F2937' }}>{driver.kyc?.fullName || driver.name || 'Unknown'}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{driver.phone} • {driver.vehicle?.label || 'No vehicle'} — {driver.vehicle?.model || ''}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  Earnings: ₹{Math.round((driver.earnings?.totalInPaise || 0) / 100)} •
                  {driver.status === 'online' ? ' 🟢 Online' : ' 🔴 Offline'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{ backgroundColor: (kycColor[driver.kyc?.status || 'not_started']) + '20', color: kycColor[driver.kyc?.status || 'not_started'], padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                  {driver.kyc?.status || 'not_started'}
                </span>
                {driver.blocked && <span style={{ backgroundColor: '#EF444420', color: '#EF4444', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>BLOCKED</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No drivers found</div>}
        </Card>

        {selected && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Driver Details</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            {[
              ['Name', selected.kyc?.fullName || selected.name],
              ['Phone', selected.phone],
              ['Email', selected.email],
              ['KYC Status', selected.kyc?.status || 'not_started'],
              ['Vehicle', `${selected.vehicle?.label || '—'} — ${selected.vehicle?.model || ''}`],
              ['Number', selected.vehicle?.number || '—'],
              ['Status', selected.status === 'online' ? '🟢 Online' : '🔴 Offline'],
              ['Today Earned', `₹${Math.round((selected.earnings?.todayInPaise || 0) / 100)}`],
              ['Total Earned', `₹${Math.round((selected.earnings?.totalInPaise || 0) / 100)}`],
              ['Joined', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1F2937' }}>{v || '—'}</span>
              </div>
            ))}
            <button onClick={() => toggleBlock(selected)} style={{ width: '100%', marginTop: 20, padding: 12, backgroundColor: selected.blocked ? '#10B981' : '#EF4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {selected.blocked ? '✅ Unblock Driver' : '🚫 Block Driver'}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
