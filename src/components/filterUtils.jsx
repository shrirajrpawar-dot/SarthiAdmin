import React from 'react';
import { tokens } from './Card.jsx';

// — — Date range presets — —
export const DATE_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
];

// Returns {start, end} as Date objects (or null for unbounded)
export function getDateRange(key) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { start: startOfToday, end: new Date(startOfToday.getTime() + 86400000) };
    case 'yesterday': {
      const y = new Date(startOfToday.getTime() - 86400000);
      return { start: y, end: startOfToday };
    }
    case '7d':
      return { start: new Date(startOfToday.getTime() - 7 * 86400000), end: null };
    case '30d':
      return { start: new Date(startOfToday.getTime() - 30 * 86400000), end: null };
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case 'all':
    default:
      return { start: null, end: null };
  }
}

// Pulls a Date out of either a Firestore Timestamp or an ISO string
export function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'string') return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

// Filter array by date range using a getter that returns the doc's relevant date
export function filterByDateRange(items, key, getDate) {
  const { start, end } = getDateRange(key);
  if (!start && !end) return items;
  return items.filter((i) => {
    const d = getDate(i);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d >= end) return false;
    return true;
  });
}

// — — CSV export — —
export function exportCSV(filename, columns, rows) {
  // columns: [{ header: 'Name', get: (row) => row.name }, ...]
  const escape = (val) => {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerRow = columns.map((c) => escape(c.header)).join(',');
  const dataRows = rows.map((r) => columns.map((c) => escape(c.get(r))).join(','));
  const csv = [headerRow, ...dataRows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// — — Reusable filter bar component — —
export function FilterBar({
  search, setSearch, searchPlaceholder = 'Search...',
  dateRange, setDateRange,
  statusOptions, status, setStatus,
  onExport, exportLabel = 'Export CSV',
  rightExtras = null,
}) {
  const inputStyle = {
    padding: '10px 14px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    outline: 'none',
    color: tokens.textPrimary,
    backgroundColor: tokens.bgCard,
  };
  const pillBtn = (active) => ({
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? tokens.dark : tokens.border}`,
    backgroundColor: active ? tokens.dark : tokens.bgCard,
    color: active ? '#FFFFFF' : tokens.textSecondary,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Top row: search + date range select + export */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        {setDateRange && (
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ ...inputStyle, fontWeight: 700, paddingRight: 30, minWidth: 140 }}
          >
            {DATE_RANGES.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        )}
        {onExport && (
          <button
            onClick={onExport}
            style={{
              padding: '10px 16px',
              backgroundColor: tokens.bgCard,
              color: tokens.textPrimary,
              border: `1px solid ${tokens.border}`,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⤓ {exportLabel}
          </button>
        )}
        {rightExtras}
      </div>

      {/* Status pill bar */}
      {statusOptions && statusOptions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatus(opt.key)}
              style={pillBtn(status === opt.key)}
            >
              {opt.label}
              {opt.count != null && (
                <span style={{
                  marginLeft: 6,
                  backgroundColor: status === opt.key ? '#FFFFFF20' : tokens.bgPanel,
                  color: status === opt.key ? '#FFFFFF' : tokens.textMuted,
                  padding: '1px 7px',
                  borderRadius: 999,
                  fontSize: 10,
                }}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
