import type { CSSProperties } from 'react';

export const pageStyle: CSSProperties = {
  padding: 24,
  maxWidth: 1080,
  margin: '0 auto',
};

export const cardStyle: CSSProperties = {
  border: '1px solid #e0dcd5',
  borderRadius: 8,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

export const inputStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cfc9bf',
  borderRadius: 4,
  fontSize: 14,
};

export const primaryBtn: CSSProperties = {
  padding: '7px 16px',
  borderRadius: 4,
  border: '1px solid #8c6f4e',
  background: '#8c6f4e',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

export const ghostBtn: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 4,
  border: '1px solid #bdc3c7',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};

export const dangerBtn: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 4,
  border: '1px solid #e74c3c',
  background: '#fff',
  color: '#e74c3c',
  cursor: 'pointer',
  fontSize: 13,
};

export function tdStyle(): CSSProperties {
  return { padding: '8px 10px', borderBottom: '1px solid #eee8df' };
}
