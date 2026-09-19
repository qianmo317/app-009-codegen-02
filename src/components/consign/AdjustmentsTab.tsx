import { useConsignmentStore } from '../../store/consignmentStore';
import { Table } from './ui';
import { cardStyle, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

export default function AdjustmentsTab() {
  const adjustments = useConsignmentStore((s) => s.adjustments);
  const settlements = useConsignmentStore((s) => s.settlements);
  const { shopName, styleName, colorName } = useConsignNames();

  const rows = [...adjustments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <section style={cardStyle}>
      <h3 style={{ margin: '0 0 4px' }}>改价说明留档</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
        每一次改价都必须写明原因；归入已结账对账单的说明永久锁定，不可修改或删除。
      </p>
      <Table headers={['登记日期', '店铺', '款式 / 颜色', '类型', '原价', '新价', '原因', '归档状态']}>
        {rows.map((a) => {
          const st = a.settlementId ? settlements.find((x) => x.id === a.settlementId) : undefined;
          return (
            <tr key={a.id}>
              <td style={tdStyle()}>{a.date}</td>
              <td style={tdStyle()}>{shopName(a.shopId)}</td>
              <td style={tdStyle()}>{styleName(a.styleId)} / {colorName(a.colorId)}</td>
              <td style={tdStyle()}>{a.kind === 'delivery' ? '送货约定价修改' : '成交价不同于约定价'}</td>
              <td style={tdStyle()}>{a.oldPrice.toFixed(2)}</td>
              <td style={{ ...tdStyle(), color: '#c08a3e', fontWeight: 600 }}>{a.newPrice.toFixed(2)}</td>
              <td style={{ ...tdStyle(), maxWidth: 260 }}>{a.reason}</td>
              <td style={tdStyle()}>
                {st ? <span style={{ color: '#8c6f4e' }}>🔒 已并入 {st.period} 对账单</span> : <span style={{ color: '#999' }}>待结账归档</span>}
              </td>
            </tr>
          );
        })}
      </Table>
      {rows.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>还没有改价记录。改送货单价、或以不同于约定价的价格成交时，系统会要求填写说明。</p>}
    </section>
  );
}
