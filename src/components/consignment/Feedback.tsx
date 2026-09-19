export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: '#fdecea',
        border: '1px solid #f5c6c0',
        color: '#a93226',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        margin: '10px 0',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span>⚠️ {message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a93226' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
