import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/consignment', label: '总览', end: true },
  { to: '/consignment/shops', label: '小店' },
  { to: '/consignment/products', label: '款式 · 库存' },
  { to: '/consignment/deliveries', label: '送货登记' },
  { to: '/consignment/returns', label: '退货登记' },
  { to: '/consignment/settlements', label: '月度对账' },
];

export default function ConsignmentLayout() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 20px',
          background: '#fff',
          borderBottom: '1px solid #e0dcd5',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid #bdc3c7',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          ← 图解首页
        </button>
        <strong style={{ fontSize: 16 }}>🧶 成品寄售对账</strong>
        <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              style={({ isActive }) => ({
                padding: '5px 12px',
                borderRadius: 16,
                fontSize: 13,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#555',
                background: isActive ? '#3498db' : 'transparent',
                border: isActive ? '1px solid #3498db' : '1px solid transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
