import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { PageTitle, Card, tokens } from '../components/Card.jsx';

// ============================================================
// Default vehicles
// ============================================================

const DEFAULT_PARCEL_VEHICLES = [
  { id: 'bike',                label: 'Bike',                 icon: '🏍️', baseFare: 30,  perKm: 8,  capacity: '20 kg',   commission: 20, pickupFreeKm: 2, pickupKmRate: 5,  enabled: true, service: 'parcel' },
  { id: 'scooty',              label: 'Scooty',               icon: '🛵', baseFare: 40,  perKm: 10, capacity: '50 kg',   commission: 20, pickupFreeKm: 2, pickupKmRate: 6,  enabled: true, service: 'parcel' },
  { id: '3wheeler_transport',  label: '3 Wheeler Transport',  icon: '🛺', baseFare: 50,  perKm: 12, capacity: '300 kg',  commission: 18, pickupFreeKm: 2, pickupKmRate: 8,  enabled: true, service: 'parcel' },
  { id: 'chota_hatti',         label: 'Chota Hatti',          icon: '🚛', baseFare: 70,  perKm: 15, capacity: '500 kg',  commission: 15, pickupFreeKm: 2, pickupKmRate: 10, enabled: true, service: 'parcel' },
  { id: 'tempo',               label: 'Tempo',                icon: '🚚', baseFare: 100, perKm: 20, capacity: '1500 kg', commission: 15, pickupFreeKm: 2, pickupKmRate: 15, enabled: true, service: 'parcel' },
];

const DEFAULT_RIDE_VEHICLES = [
  { id: 'bike',       label: 'Bike',              icon: '🏍️', baseFare: 50,  perKm: 15, capacity: '1 Pax', commission: 25, pickupFreeKm: 2, pickupKmRate: 5,  enabled: true, service: 'ride' },
  { id: 'scooty',     label: 'Scooty',            icon: '🛵', baseFare: 60,  perKm: 18, capacity: '2 Pax', commission: 25, pickupFreeKm: 2, pickupKmRate: 6,  enabled: true, service: 'ride' },
  { id: '3wheeler',   label: '3 Wheeler Rickshaw',icon: '🛺', baseFare: 40,  perKm: 12, capacity: '3 Pax', commission: 20, pickupFreeKm: 2, pickupKmRate: 7,  enabled: true, service: 'ride' },
  { id: 'sedan',      label: 'Sedan',             icon: '🚗', baseFare: 100, perKm: 25, capacity: '4 Pax', commission: 30, pickupFreeKm: 2, pickupKmRate: 12, enabled: true, service: 'ride' },
  { id: 'hatchback',  label: 'Hatchback',         icon: '🚙', baseFare: 80,  perKm: 20, capacity: '4 Pax', commission: 28, pickupFreeKm: 2, pickupKmRate: 10, enabled: true, service: 'ride' },
  { id: '7seater',    label: '7 Seater',          icon: '🚐', baseFare: 150, perKm: 30, capacity: '7 Pax', commission: 30, pickupFreeKm: 2, pickupKmRate: 18, enabled: true, service: 'ride' },
];

// ============================================================
// Module-scope styles
// ============================================================

const styles = {
  input: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: tokens.textPrimary,
    backgroundColor: tokens.bgPanel,
    boxSizing: 'border-box',
    outline: 'none',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: tokens.textMuted,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    display: 'block',
  },
};

// ============================================================
// Subcomponents — DEFINED AT MODULE SCOPE so React doesn't
// remount them on every parent render. This was the bug
// causing inputs to lose focus after one keystroke.
// ============================================================

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function VehicleCard({ v, idx, service, onChange, onDelete, onPhotoUpload, searchRadiusKm }) {
  const [uploading, setUploading] = useState(false);

  const handleChange = (field, value) => {
    const numFields = ['baseFare', 'perKm', 'commission', 'pickupFreeKm', 'pickupKmRate'];
    const cleanValue = numFields.includes(field) ? Number(value) : value;
    onChange(idx, field, cleanValue, service);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onPhotoUpload(file, v.id || `new_${idx}`);
      handleChange('photoUrl', url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  return (
    <div style={{
      border: `1px solid ${tokens.border}`,
      borderRadius: 14,
      padding: 14,
      backgroundColor: tokens.bgPanel,
    }}>
      {/* Top: icon/photo + label + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {v.photoUrl ? (
          <img src={v.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        ) : v._isNew ? (
          <input
            value={v.icon || ''}
            onChange={(e) => handleChange('icon', e.target.value)}
            style={{ ...styles.input, width: 46, fontSize: 18, textAlign: 'center', padding: '6px', flexShrink: 0 }}
            maxLength={3}
            placeholder="🚗"
          />
        ) : (
          <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{v.icon}</span>
        )}
        {v._isNew ? (
          <input
            value={v.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            style={{ ...styles.input, fontWeight: 700, fontSize: 13 }}
            placeholder="Vehicle name"
          />
        ) : (
          <span style={{ flex: 1, fontWeight: 800, fontSize: 14, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.label}
          </span>
        )}
        <button
          onClick={() => onDelete(idx, service)}
          style={{
            padding: '6px 8px',
            fontSize: 12,
            color: tokens.red,
            backgroundColor: tokens.redSoft,
            border: `1px solid #FECACA`,
            borderRadius: 8,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Delete"
        >
          🗑️
        </button>
      </div>

      {/* Photo upload + enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <label style={{
          fontSize: 11,
          fontWeight: 700,
          color: tokens.textSecondary,
          padding: '5px 10px',
          backgroundColor: tokens.bgCard,
          border: `1px dashed ${tokens.borderStrong}`,
          borderRadius: 8,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
          {uploading ? '⏳ Uploading' : (v.photoUrl ? '🖼️ Change' : '🖼️ Upload')}
        </label>
        {v.photoUrl && (
          <button
            onClick={() => handleChange('photoUrl', '')}
            style={{
              padding: '4px 6px',
              fontSize: 10,
              color: tokens.textMuted,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Remove
          </button>
        )}
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 10, color: tokens.textMuted, fontWeight: 700 }}>
            {v.enabled ? 'ON' : 'OFF'}
          </span>
          <input
            type="checkbox"
            checked={!!v.enabled}
            onChange={() => handleChange('enabled', !v.enabled)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: tokens.green }}
          />
        </label>
      </div>

      {v._isNew && (
        <div style={{ marginBottom: 10 }}>
          <label style={styles.label}>Vehicle ID</label>
          <input
            value={v.id || ''}
            onChange={(e) => handleChange('id', e.target.value.replace(/[^a-z0-9_]/g, '_').toLowerCase())}
            style={styles.input}
            placeholder="e.g. mini_truck"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={styles.label}>Base ₹</label>
          <input type="number" value={v.baseFare ?? 0} onChange={(e) => handleChange('baseFare', e.target.value)} style={styles.input} />
        </div>
        <div>
          <label style={styles.label}>Per KM ₹</label>
          <input type="number" value={v.perKm ?? 0} onChange={(e) => handleChange('perKm', e.target.value)} style={styles.input} />
        </div>
        <div>
          <label style={styles.label}>Capacity</label>
          <input value={v.capacity || ''} onChange={(e) => handleChange('capacity', e.target.value)} style={styles.input} />
        </div>
        <div>
          <label style={styles.label}>Commission %</label>
          <input type="number" min="5" max="50" value={v.commission ?? 20} onChange={(e) => handleChange('commission', e.target.value)} style={styles.input} />
        </div>
      </div>

      <div style={{ paddingTop: 10, borderTop: `1px dashed ${tokens.borderStrong}` }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Pickup Pricing
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={styles.label}>Free KM</label>
            <input type="number" min="0" max="20" value={v.pickupFreeKm ?? 2} onChange={(e) => handleChange('pickupFreeKm', e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>₹ / Extra KM</label>
            <input type="number" min="0" value={v.pickupKmRate ?? 0} onChange={(e) => handleChange('pickupKmRate', e.target.value)} style={styles.input} />
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 8,
        padding: 8,
        backgroundColor: tokens.bgCard,
        borderRadius: 8,
        fontSize: 10,
        color: tokens.textMuted,
        lineHeight: 1.6,
      }}>
        5km: <b style={{ color: tokens.textPrimary }}>₹{(Number(v.baseFare) || 0) + 5 * (Number(v.perKm) || 0)}</b>
        {' · '}
        Max premium: <b style={{ color: tokens.green }}>+₹{Math.max(0, Number(searchRadiusKm) - (Number(v.pickupFreeKm) || 0)) * (Number(v.pickupKmRate) || 0)}</b>
      </div>
    </div>
  );
}

function VehicleSection({ vehicles, service, sectionTitle, onChange, onDelete, onAdd, onPhotoUpload, searchRadiusKm }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
          {sectionTitle}
        </h2>
        <span style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
          {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 12,
      }}>
        {vehicles.map((v, idx) => (
          <VehicleCard
            key={`${service}_${idx}`}
            v={v}
            idx={idx}
            service={service}
            onChange={onChange}
            onDelete={onDelete}
            onPhotoUpload={onPhotoUpload}
            searchRadiusKm={searchRadiusKm}
          />
        ))}
      </div>

      <button
        onClick={() => onAdd(service)}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: tokens.bgCard,
          color: tokens.textSecondary,
          border: `1.5px dashed ${tokens.borderStrong}`,
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          marginTop: 12,
        }}
      >
        + Add {service === 'parcel' ? 'Parcel' : 'Ride'} Vehicle
      </button>
    </Card>
  );
}

// ============================================================
// Main Settings page
// ============================================================

export default function Settings() {
  const [parcelVehicles, setParcelVehicles] = useState(DEFAULT_PARCEL_VEHICLES);
  const [rideVehicles, setRideVehicles] = useState(DEFAULT_RIDE_VEHICLES);
  const [upiId, setUpiId] = useState('sarthi@upi');
  const [appName, setAppName] = useState('Sarthi');
  const [searchRadiusKm, setSearchRadiusKm] = useState(5);
  const [maxOwedCommission, setMaxOwedCommission] = useState(500);
  const [paymentMethods, setPaymentMethods] = useState({
    cod:        { enabled: true,  label: 'Cash on Delivery' },
    upi_direct: { enabled: true,  label: 'Pay Driver via UPI' },
    razorpay:   { enabled: false, label: 'Pay via Razorpay' },
  });
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const merge = (saved, defaults) =>
          (saved || defaults).map((v) => {
            const def = defaults.find((d) => d.id === v.id) || {};
            return {
              ...def,
              ...v,
              pickupFreeKm: v.pickupFreeKm ?? def.pickupFreeKm ?? 2,
              pickupKmRate: v.pickupKmRate ?? def.pickupKmRate ?? 5,
            };
          });
        setParcelVehicles(merge(data.parcelVehicles, DEFAULT_PARCEL_VEHICLES));
        setRideVehicles(merge(data.rideVehicles, DEFAULT_RIDE_VEHICLES));
        if (data.upiId) setUpiId(data.upiId);
        if (data.appName) setAppName(data.appName);
        if (data.searchRadiusKm) setSearchRadiusKm(data.searchRadiusKm);
        if (data.maxOwedCommission != null) setMaxOwedCommission(data.maxOwedCommission);
        if (data.paymentMethods) {
          setPaymentMethods((prev) => ({ ...prev, ...data.paymentMethods }));
        }
        if (data.razorpayKeyId) setRazorpayKeyId(data.razorpayKeyId);
      }
    });
    return () => unsub();
  }, []);

  const togglePaymentMethod = (key) => {
    setPaymentMethods((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const updateVehicle = (idx, field, value, service) => {
    const list = service === 'parcel' ? parcelVehicles : rideVehicles;
    const setList = service === 'parcel' ? setParcelVehicles : setRideVehicles;
    const updated = [...list];
    updated[idx] = { ...updated[idx], [field]: value };
    setList(updated);
  };

  const removeVehicle = (idx, service) => {
    const list = service === 'parcel' ? parcelVehicles : rideVehicles;
    const v = list[idx];
    if (!window.confirm(`Delete vehicle "${v.label || v.id}"?`)) return;
    const setList = service === 'parcel' ? setParcelVehicles : setRideVehicles;
    setList(list.filter((_, i) => i !== idx));
  };

  const addVehicle = (service) => {
    const list = service === 'parcel' ? parcelVehicles : rideVehicles;
    const setList = service === 'parcel' ? setParcelVehicles : setRideVehicles;
    let n = 1;
    while (list.find(v => v.id === `custom_${n}`)) n++;
    const newVehicle = {
      id: `custom_${n}`,
      label: '',
      icon: '🚗',
      photoUrl: '',
      baseFare: 50,
      perKm: 10,
      capacity: 'Standard',
      commission: 20,
      pickupFreeKm: 2,
      pickupKmRate: 5,
      enabled: false,
      service,
      _isNew: true,
    };
    setList([...list, newVehicle]);
  };

  const uploadPhoto = async (file, vehicleId) => {
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `vehicleIcons/${vehicleId}_${ts}_${safeName}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const cleanList = (list) => list.map(({ _isNew, ...v }) => v);
      const dupCheck = (list, name) => {
        const ids = list.map((v) => v.id);
        const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dups.length > 0) throw new Error(`Duplicate ${name} vehicle ID: ${dups[0]}`);
        if (ids.some((id) => !id || !id.trim())) throw new Error(`Empty vehicle ID in ${name} list`);
      };
      dupCheck(parcelVehicles, 'parcel');
      dupCheck(rideVehicles, 'ride');

      await setDoc(doc(db, 'settings', 'app'), {
        parcelVehicles: cleanList(parcelVehicles),
        rideVehicles: cleanList(rideVehicles),
        upiId,
        appName,
        searchRadiusKm: Number(searchRadiusKm) || 5,
        maxOwedCommission: Number(maxOwedCommission) || 500,
        paymentMethods,
        razorpayKeyId,
        updatedAt: new Date().toISOString(),
      });
      setSavedMsg('✓ Settings saved');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      setSavedMsg('Error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <PageTitle title="App Settings" sub="Configure vehicles, pricing, payment, and pickup premiums" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Row label="App Name">
            <input value={appName} onChange={(e) => setAppName(e.target.value)} style={styles.input} />
          </Row>
          <Row label="Company UPI ID">
            <input value={upiId} onChange={(e) => setUpiId(e.target.value)} style={styles.input} placeholder="yourcompany@upi" />
          </Row>
          <Row label="Driver Search Radius (km)">
            <input type="number" min="1" max="20" value={searchRadiusKm} onChange={(e) => setSearchRadiusKm(e.target.value)} style={styles.input} />
          </Row>
          <Row label="Max Owed Commission (₹)">
            <input type="number" min="0" value={maxOwedCommission} onChange={(e) => setMaxOwedCommission(e.target.value)} style={styles.input} placeholder="500" />
          </Row>
        </div>
        <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 500, marginTop: 4 }}>
          Search radius: customer sees worst-case fare based on this. Max owed: driver can't go online if they owe more than this amount in commission.
        </div>
      </Card>

      <VehicleSection
        vehicles={parcelVehicles}
        service="parcel"
        sectionTitle="Parcel Delivery Vehicles"
        onChange={updateVehicle}
        onDelete={removeVehicle}
        onAdd={addVehicle}
        onPhotoUpload={uploadPhoto}
        searchRadiusKm={searchRadiusKm}
      />

      <VehicleSection
        vehicles={rideVehicles}
        service="ride"
        sectionTitle="Ride Sharing Vehicles"
        onChange={updateVehicle}
        onDelete={removeVehicle}
        onAdd={addVehicle}
        onPhotoUpload={uploadPhoto}
        searchRadiusKm={searchRadiusKm}
      />

      {/* Payment Methods Section */}
      <Card style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, margin: 0, marginBottom: 14 }}>
          Payment Methods
        </h2>
        <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 16, fontWeight: 500 }}>
          Toggle which payment methods customers can use. Disabled methods are hidden in the customer app.
        </div>

        {Object.entries(paymentMethods).map(([key, method]) => (
          <div key={key} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            border: `1px solid ${tokens.border}`,
            borderRadius: 12,
            backgroundColor: method.enabled ? tokens.bgPanel : tokens.bgCard,
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary }}>
                {key === 'cod' ? '💵' : key === 'upi_direct' ? '💳' : '🔷'} {method.label}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 3, fontWeight: 500 }}>
                {key === 'cod' && 'Customer pays driver in cash on delivery'}
                {key === 'upi_direct' && "Customer pays directly to driver's UPI ID via deep link"}
                {key === 'razorpay' && 'Customer pays Sarthi via Razorpay (cards/UPI/wallets). Requires Razorpay account.'}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700 }}>
                {method.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <input
                type="checkbox"
                checked={method.enabled}
                onChange={() => togglePaymentMethod(key)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: tokens.green }}
              />
            </label>
          </div>
        ))}

        {paymentMethods.razorpay?.enabled && (
          <div style={{
            marginTop: 14,
            padding: 14,
            backgroundColor: '#FEF3C7',
            border: `1px solid #FDE68A`,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Razorpay Configuration
            </div>
            <Row label="Razorpay Key ID (public)">
              <input
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                style={styles.input}
                placeholder="rzp_test_xxxxxxxxxxxxxx or rzp_live_xxxxxxxxxxxxxx"
              />
            </Row>
            <div style={{ fontSize: 11, color: '#92400E', fontWeight: 500, marginTop: -4 }}>
              <b>Important:</b> The Key Secret is NOT stored here. Set it via Firebase Functions config:
              <br/>
              <code style={{ fontSize: 11, backgroundColor: '#FFFBEB', padding: '2px 5px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                firebase functions:config:set razorpay.key_secret="YOUR_SECRET"
              </code>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <button
          onClick={saveSettings}
          disabled={loading}
          style={{
            padding: '12px 28px',
            backgroundColor: tokens.dark,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            letterSpacing: 0.3,
          }}
        >
          {loading ? 'Saving...' : 'Save All Settings'}
        </button>
        {savedMsg && (
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: savedMsg.startsWith('Error') ? tokens.red : tokens.green,
          }}>
            {savedMsg}
          </span>
        )}
      </div>

      <div style={{
        padding: 14,
        backgroundColor: tokens.amberSoft,
        borderRadius: 12,
        fontSize: 12,
        color: '#92400E',
        border: `1px solid #FDE68A`,
      }}>
        <b>Note:</b> Pricing changes apply to new bookings only. Existing bookings keep their original pricing.
      </div>
    </div>
  );
}