import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card } from '../components/Card.jsx';

const DEFAULT_PARCEL_VEHICLES = [
  { id: 'bike', label: 'Bike', icon: '🏍️', baseFare: 30, perKm: 8, capacity: '20 kg', commission: 20, enabled: true, service: 'parcel' },
  { id: 'scooty', label: 'Scooty', icon: '🛵', baseFare: 40, perKm: 10, capacity: '50 kg', commission: 20, enabled: true, service: 'parcel' },
  { id: '3wheeler', label: '3 Wheeler Transport', icon: '🛺', baseFare: 50, perKm: 12, capacity: '300 kg', commission: 18, enabled: true, service: 'parcel' },
  { id: 'chota_hatti', label: 'Chota Hatti', icon: '🚛', baseFare: 70, perKm: 15, capacity: '500 kg', commission: 15, enabled: true, service: 'parcel' },
  { id: 'tempo', label: 'Tempo', icon: '🚚', baseFare: 100, perKm: 20, capacity: '1500 kg', commission: 15, enabled: true, service: 'parcel' },
];

const DEFAULT_RIDE_VEHICLES = [
  { id: 'bike', label: 'Bike', icon: '🏍️', baseFare: 50, perKm: 15, capacity: '1 Pax', commission: 25, enabled: true, service: 'ride' },
  { id: 'scooty', label: 'Scooty', icon: '🛵', baseFare: 60, perKm: 18, capacity: '2 Pax', commission: 25, enabled: true, service: 'ride' },
  { id: '3wheeler', label: '3 Wheeler Rickshaw', icon: '🛺', baseFare: 40, perKm: 12, capacity: '3 Pax', commission: 20, enabled: true, service: 'ride' },
  { id: 'sedan', label: 'Sedan', icon: '🚗', baseFare: 100, perKm: 25, capacity: '4 Pax', commission: 30, enabled: true, service: 'ride' },
  { id: 'hatchback', label: 'Hatchback', icon: '🚙', baseFare: 80, perKm: 20, capacity: '4 Pax', commission: 28, enabled: true, service: 'ride' },
  { id: '7seater', label: '7 Seater', icon: '🚐', baseFare: 150, perKm: 30, capacity: '7 Pax', commission: 30, enabled: true, service: 'ride' },
];

export default function Settings() {
  const [parcelVehicles, setParcelVehicles] = useState(DEFAULT_PARCEL_VEHICLES);
  const [rideVehicles, setRideVehicles] = useState(DEFAULT_RIDE_VEHICLES);
  const [upiId, setUpiId] = useState('loadgo@upi');
  const [appName, setAppName] = useState('LoadGo');
  const [savedMsg, setSavedMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.parcelVehicles) setParcelVehicles(data.parcelVehicles);
        if (data.rideVehicles) setRideVehicles(data.rideVehicles);
        if (data.upiId) setUpiId(data.upiId);
        if (data.appName) setAppName(data.appName);
      }
    });
    return () => unsub();
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        parcelVehicles,
        rideVehicles,
        upiId,
        appName,
        updatedAt: new Date().toISOString(),
      });
      setSavedMsg('✅ Settings saved!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      setSavedMsg('❌ Error: ' + e.message);
    }
    setLoading(false);
  };

  const updateVehicle = (idx, field, value, service = 'parcel') => {
    const vehicles = service === 'parcel' ? parcelVehicles : rideVehicles;
    const setVehicles = service === 'parcel' ? setParcelVehicles : setRideVehicles;
    const updated = [...vehicles];
    updated[idx] = { ...updated[idx], [field]: field === 'baseFare' || field === 'perKm' || field === 'commission' ? Number(value) : value };
    setVehicles(updated);
  };

  const inputStyle = { width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontWeight: '500', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#6B7280', marginBottom: '6px' };
  const Row = ({ label, children }) => <div style={{ marginBottom: '20px' }}><div style={labelStyle}>{label}</div>{children}</div>;

  return (
    <div>
      <PageTitle title="⚙️ App Settings" sub="Configure vehicles, pricing, and payment" />

      <Card style={{ marginBottom: 20 }}>
        <Row label="App Name">
          <input value={appName} onChange={(e) => setAppName(e.target.value)} style={inputStyle} />
        </Row>
        <Row label="Company UPI ID">
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} style={inputStyle} placeholder="yourcompany@upi" />
        </Row>
      </Card>

      {/* PARCEL Vehicles */}
      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', marginBottom: 20 }}>📦 Parcel Delivery Vehicles</h2>
        {parcelVehicles.map((v, idx) => (
          <div key={v.id} style={{ border: '1.5px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>{v.icon} <span style={{ fontWeight: 700, fontSize: 16 }}>{v.label}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{v.enabled ? '✅ Enabled' : '❌ Disabled'}</span>
                <input 
                  type="checkbox" 
                  checked={v.enabled} 
                  onChange={() => updateVehicle(idx, 'enabled', !v.enabled, 'parcel')}
                  style={{ width: 24, height: 24, cursor: 'pointer', accentColor: '#10B981' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Base Fare (₹)</label>
                <input type="number" value={v.baseFare} onChange={(e) => updateVehicle(idx, 'baseFare', e.target.value, 'parcel')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Per KM (₹)</label>
                <input type="number" value={v.perKm} onChange={(e) => updateVehicle(idx, 'perKm', e.target.value, 'parcel')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Capacity</label>
                <input value={v.capacity} onChange={(e) => updateVehicle(idx, 'capacity', e.target.value, 'parcel')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Commission %</label>
                <input type="number" min="5" max="50" value={v.commission} onChange={(e) => updateVehicle(idx, 'commission', e.target.value, 'parcel')} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, color: '#9CA3AF' }}>
              <div>Example 5km: ₹{v.baseFare} + (5 × ₹{v.perKm}) = <b>₹{v.baseFare + 5 * v.perKm}</b></div>
              <div>Driver gets: <b style={{ color: '#10B981' }}>{100 - v.commission}%</b> | LoadGo gets: <b style={{ color: '#10B981' }}>{v.commission}%</b></div>
            </div>
          </div>
        ))}
      </Card>

      {/* RIDE Vehicles */}
      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', marginBottom: 20 }}>🚗 Ride Sharing Vehicles</h2>
        {rideVehicles.map((v, idx) => (
          <div key={v.id} style={{ border: '1.5px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>{v.icon} <span style={{ fontWeight: 700, fontSize: 16 }}>{v.label}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{v.enabled ? '✅ Enabled' : '❌ Disabled'}</span>
                <input 
                  type="checkbox" 
                  checked={v.enabled} 
                  onChange={() => updateVehicle(idx, 'enabled', !v.enabled, 'ride')}
                  style={{ width: 24, height: 24, cursor: 'pointer', accentColor: '#10B981' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Base Fare (₹)</label>
                <input type="number" value={v.baseFare} onChange={(e) => updateVehicle(idx, 'baseFare', e.target.value, 'ride')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Per KM (₹)</label>
                <input type="number" value={v.perKm} onChange={(e) => updateVehicle(idx, 'perKm', e.target.value, 'ride')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Capacity</label>
                <input value={v.capacity} onChange={(e) => updateVehicle(idx, 'capacity', e.target.value, 'ride')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Commission %</label>
                <input type="number" min="5" max="50" value={v.commission} onChange={(e) => updateVehicle(idx, 'commission', e.target.value, 'ride')} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, color: '#9CA3AF' }}>
              <div>Example 5km: ₹{v.baseFare} + (5 × ₹{v.perKm}) = <b>₹{v.baseFare + 5 * v.perKm}</b></div>
              <div>Driver gets: <b style={{ color: '#10B981' }}>{100 - v.commission}%</b> | LoadGo gets: <b style={{ color: '#10B981' }}>{v.commission}%</b></div>
            </div>
          </div>
        ))}
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={saveSettings} disabled={loading}
          style={{ padding: '14px 32px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving...' : '💾 Save All Settings'}
        </button>
        {savedMsg && <span style={{ fontSize: 15, fontWeight: 600, color: savedMsg.startsWith('✅') ? '#10B981' : '#EF4444' }}>{savedMsg}</span>}
      </div>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 10, fontSize: 13, color: '#92400E' }}>
        ⚠️ <b>Note:</b> Pricing changes apply to new bookings only. Existing bookings keep their original pricing.
      </div>
    </div>
  );
}