import type { CSSProperties } from 'react';

/** 与项目既有内联风格一致的一组设计常量 */
export const C = {
  border: '#e0dcd5',
  paper: '#faf8f5',
  bg: '#f5f3ef',
  primary: '#3498db',
  danger: '#e74c3c',
  warn: '#e67e22',
  ok: '#27ae60',
  muted: '#888',
} as const;

export const pageStyle: CSSProperties = {
  padding: 24,
  maxWidth: 1080,
  margin: '0 auto',
};

export const cardStyle: CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: 16,
  background: '#fff',
};

export const inputStyle: CSSProperties = {
  padding: '6px 8px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 14,
  background: '#fff',
};

export const btnPrimary: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 4,
  border: `1px solid ${C.primary}`,
  background: C.primary,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

export const btnGhost: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: `1px solid ${C.primary}`,
  background: '#fff',
  color: C.primary,
  cursor: 'pointer',
  fontSize: 13,
};

export const btnDanger: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: `1px solid ${C.danger}`,
  background: '#fff',
  color: C.danger,
  cursor: 'pointer',
  fontSize: 13,
};

export const btnSmall: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 4,
  border: `1px solid #bdc3c7`,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  background: '#fff',
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: `2px solid ${C.border}`,
  whiteSpace: 'nowrap',
  fontWeight: 600,
  color: '#555',
};

export const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #eee9e2',
  verticalAlign: 'middle',
};

export const labelStyle: CSSProperties = {
  fontSize: 12,
  color: C.muted,
  display: 'block',
  marginBottom: 4,
};
