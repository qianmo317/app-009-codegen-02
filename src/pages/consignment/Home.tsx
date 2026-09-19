import { useNavigate } from 'react-router-dom';
import { useConsignmentStore } from '../../store/consignmentStore';
import {
  money,
  onShopFloor,
  availableStock,
  totalStock,
  latestConfirmed,
  productLabel,
  periodLabel,
  settlementTotals,
} from '../../utils/consignment';
import { pageStyle, cardStyle, btnPrimary, btnGhost, C } from '../../components/consignment/ui';

export default function ConsignmentHome() {
  const navigate = useNavigate();
  const { shops, products, deliveries, returns: returnsList, settlements, seedDemo, resetAll } =
    useConsignmentStore();

  if (shops.length === 0 && products.length === 0) {
    return (
      <div style={{ ...pageStyle, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 48 }}>🧶</div>
        <h1 style={{ fontSize: 22 }}>成品寄售 · 按月对账</h1>
        <p style={{ color: C.muted, maxWidth: 560, margin: '12px auto', lineHeight: 1.8 }}>
          登记每次送货（款式 / 颜色 / 件数 / 售价 / 分成），退货逐笔记录，
          退回的件自动回到手上库存、可以再送到别家。
          月底按店把对方报来的卖出、退货、店存录入，系统自动核账，
          差在哪逐行列出；已结账的批次自动锁定，改价必须留一次说明。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button style={btnPrimary} onClick={() => navigate('/consignment/shops')}>
            开始：先登记一家小店
          </button>
          <button
            style={btnGhost}
            onClick={() => {
              seedDemo();
              navigate('/consignment');
            }}
          >
            载入演示数据看看
          </button>
        </div>
      </div>
    );
  }

  const drafts = settlements.filter((s) => s.status === 'draft');

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>总览</h1>
        <button
          style={{ ...btnGhost, color: C.danger, borderColor: C.danger }}
          onClick={() => {
            if (confirm('确定清空全部寄售数据？此操作不可恢复。')) resetAll();
          }}
        >
          清空全部数据
        </button>
      </div>

      {/* 小店卡片 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
          marginTop: 16,
        }}
      >
        {shops.map((shop) => {
          const floor = products.reduce(
            (sum, p) => sum + onShopFloor(useConsignmentStore.getState(), shop.id, p.id),
            0
          );
          const last = latestConfirmed(useConsignmentStore.getState(), shop.id);
          const draft = drafts.find((d) => d.shopId === shop.id);
          const pendDeliveries = deliveries.filter((d) => d.shopId === shop.id && !d.settlementId).length;
          const pendReturns = returnsList.filter((r) => r.shopId === shop.id && !r.settlementId).length;
          return (
            <div key={shop.id} style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{shop.name}</div>
              {shop.contact && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {shop.contact} {shop.phone ?? ''}
                </div>
              )}
              <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.9 }}>
                <div>店里现在共 <strong>{floor}</strong> 件</div>
                <div>
                  已结到：{last ? periodLabel(last.period) : <span style={{ color: C.muted }}>还没对过账</span>}
                </div>
                <div style={{ color: pendDeliveries + pendReturns > 0 ? C.warn : C.muted }}>
                  未结：{pendDeliveries} 张送货单 / {pendReturns} 张退货单
                </div>
                {draft && (
                  <div style={{ color: C.primary }}>
                    📝 有 {periodLabel(draft.period)} 草稿对账单
                    {settlementTotals(draft.lines).discrepancyCount > 0 && (
                      <span style={{ color: C.danger }}>
                        （{settlementTotals(draft.lines).discrepancyCount} 处差异）
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={btnGhost} onClick={() => navigate('/consignment/deliveries')}>
                  送货
                </button>
                <button style={btnGhost} onClick={() => navigate('/consignment/returns')}>
                  退货
                </button>
                <button style={btnPrimary} onClick={() => navigate('/consignment/settlements')}>
                  去对账
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 库存分布 */}
      <h2 style={{ fontSize: 16, margin: '28px 0 10px' }}>各款库存分布</h2>
      <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e0dcd5' }}>
                款式 · 颜色
              </th>
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e0dcd5' }}>
                总入库
              </th>
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e0dcd5' }}>
                手上可用
              </th>
              {shops.map((sh) => (
                <th
                  key={sh.id}
                  style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e0dcd5' }}
                >
                  {sh.name}
                </th>
              ))}
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e0dcd5' }}>
                标价
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee9e2' }}>
                  {productLabel(p)}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee9e2', textAlign: 'right' }}>
                  {totalStock(useConsignmentStore.getState(), p.id)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee9e2',
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  {availableStock(useConsignmentStore.getState(), p.id)}
                </td>
                {shops.map((sh) => (
                  <td
                    key={sh.id}
                    style={{ padding: '8px 10px', borderBottom: '1px solid #eee9e2', textAlign: 'right' }}
                  >
                    {onShopFloor(useConsignmentStore.getState(), sh.id, p.id) || '—'}
                  </td>
                ))}
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee9e2', textAlign: 'right' }}>
                  {money(p.tagPrice)}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={3 + shops.length} style={{ padding: 24, textAlign: 'center', color: C.muted }}>
                  还没有款式，先去「款式 · 库存」添加并入库
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
