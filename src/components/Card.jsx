import React from 'react';

// Design tokens — matches mobile app aesthetic
export const tokens = {
  // Surfaces
  bgScreen: '#F3F4F6',
  bgCard: '#FFFFFF',
  bgPanel: '#F9FAFB',
  // Borders / dividers
  border: '#F3F4F6',
  borderStrong: '#E5E7EB',
  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  textHint: '#9CA3AF',
  // Brand
  green: '#10B981',
  greenSoft: '#ECFDF5',
  red: '#EF4444',
  redSoft: '#FEF2F2',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  blue: '#3B82F6',
  blueSoft: '#EFF6FF',
  purple: '#8B5CF6',
  dark: '#111827',
  // Radius
  rSm: 8, rMd: 12, rLg: 14, rXl: 16, rPill: 999,
  // Shadow
  shadowCard: '0 2px 8px rgba(17, 24, 39, 0.04)',
  shadowHover: '0 4px 16px rgba(17, 24, 39, 0.08)',
};

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: tokens.bgCard,
      borderRadius: tokens.rXl,
      padding: 20,
      border: `1px solid ${tokens.border}`,
      boxShadow: tokens.shadowCard,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function StatCard({ icon, label, value, color = tokens.green, sub }) {
  // Icon may be an emoji (legacy) or a React node — supports both
  const iconBg = `${color}15`;
  return (
    <div style={{
      background: tokens.bgCard,
      borderRadius: tokens.rXl,
      padding: 20,
      border: `1px solid ${tokens.border}`,
      boxShadow: tokens.shadowCard,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: tokens.rMd,
        backgroundColor: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        marginBottom: 8,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 12,
        color: tokens.textMuted,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color, marginTop: 2, fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Badge({ label, color = tokens.green }) {
  const bg = `${color}15`;
  return (
    <span style={{
      backgroundColor: bg,
      color,
      padding: '4px 10px',
      borderRadius: tokens.rPill,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.3,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {label}
    </span>
  );
}

export function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{
        fontSize: 24,
        fontWeight: 800,
        color: tokens.textPrimary,
        margin: 0,
        lineHeight: 1.2,
      }}>
        {title}
      </h1>
      {sub && (
        <p style={{
          fontSize: 13,
          color: tokens.textMuted,
          marginTop: 4,
          fontWeight: 500,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Table({ headers, rows, emptyMsg = 'No data found' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${tokens.borderStrong}` }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 800,
                color: tokens.textMuted,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{
                textAlign: 'center',
                padding: 40,
                color: tokens.textHint,
                fontSize: 14,
              }}>{emptyMsg}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: '12px 14px',
                    fontSize: 13,
                    color: tokens.textPrimary,
                    fontWeight: 500,
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Btn({ label, onClick, color = tokens.dark, outline = false, small = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '6px 14px' : '10px 18px',
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        color: outline ? color : '#FFFFFF',
        backgroundColor: outline ? 'transparent' : color,
        border: `1.5px solid ${color}`,
        borderRadius: tokens.rMd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        marginLeft: 6,
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s',
        letterSpacing: 0.2,
      }}
    >
      {label}
    </button>
  );
}
