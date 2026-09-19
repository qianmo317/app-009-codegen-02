import { useState } from 'react';
import SettingsTab from '../components/consign/SettingsTab';
import InventoryTab from '../components/consign/InventoryTab';
import DeliveriesTab from '../components/consign/DeliveriesTab';
import SalesTab from '../components/consign/SalesTab';
import ReturnsTab from '../components/consign/ReturnsTab';
import ReconcileTab from '../components/consign/ReconcileTab';
import AdjustmentsTab from '../components/consign/AdjustmentsTab';
import { pageStyle } from '../components/consign/uiStyles';

const TABS = [
  { key: 'deliveries', label: '送货' },
  { key: 'sales', label: '卖出' },
  { key: 'returns', label: '退货回库' },
  { key: 'reconcile', label: '月底对账' },
  { key: 'inventory', label: '成品库存' },
  { key: 'adjustments', label: '改价说明' },
  { key: 'settings', label: '基础资料' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Consignment() {
  const [tab, setTab] = useState<TabKey>('deliveries');

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>寄售月结</h1>
        <a href="#/" style={{ fontSize: 13, color: '#8c6f4e' }}>← 返回我的图解</a>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e0dcd5', marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #8c6f4e' : '2px solid transparent',
              marginBottom: -2,
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: tab === t.key ? '#8c6f4e' : '#777',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && <SettingsTab />}
      {tab === 'inventory' && <InventoryTab />}
      {tab === 'deliveries' && <DeliveriesTab />}
      {tab === 'sales' && <SalesTab />}
      {tab === 'returns' && <ReturnsTab />}
      {tab === 'reconcile' && <ReconcileTab />}
      {tab === 'adjustments' && <AdjustmentsTab />}
    </div>
  );
}
