import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e0dcd5', color: '#777', fontWeight: 600 }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/** 轻量提示条 */
export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const colors = {
    error: { bg: '#fdecea', bd: '#f5c6cb', color: '#a94442' },
    success: { bg: '#edf7ee', bd: '#c3e6cb', color: '#3c763d' },
    info: { bg: '#eef4fa', bd: '#bcd6f0', color: '#31709e' },
  }[kind];
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.bd}`, color: colors.color, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
      {children}
    </div>
  );
}
