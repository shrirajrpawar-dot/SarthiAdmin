import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PageTitle, Card } from '../components/Card.jsx';

export default function Customers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [bookingCounts, setBookingCounts] = useState({});

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, 'bookings'), (snap) => {
      const counts = {};
      snap.docs.forEach((d) => {
        const uid = d.data().customerId;
        counts[uid] = (counts[uid] || 0) + 1;
      });
      setBookingCounts(counts);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const customers = users.filter((u) => !u.isDriver || u.mode === 'customer');
  const filtered = customers.filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageTitle title="👥 Customers" sub={`${customers.length} registered customers`} />
      <input placeholder="🔍 Search by name, phone or email..." value={search} onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, marginBottom: 20, outline: 'none' }} />
      <Card style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              {['Name', 'Phone', 'Email', 'Bookings', 'Mode', 'Joined'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{u.name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{u.phone}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{u.email}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#10B981' }}>{bookingCounts[u.id] || 0}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ backgroundColor: u.mode === 'driver' ? '#10B98120' : '#3B82F620', color: u.mode === 'driver' ? '#10B981' : '#3B82F6', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                    {u.mode || 'customer'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No customers found</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
