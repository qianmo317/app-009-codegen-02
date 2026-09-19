import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsignmentStore } from '../../store/consignmentStore';
import {
  currentPeriod,
  latestConfirmed,
  money,
  periodLabel,
  settlementTotals,
} from '../../utils/consignment';
import {
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  btnPrimary,
  tableStyle,
  thStyle,
  tdStyle,
  C,
} from '../../components/consignment/ui';
import { ErrorBanner } from '../../components/consignment/Feedback';
import { useActionError } from '../../components/consignment/useActionError';

export default function Settlements() {
  const navigate = useNavigate();
  const state = useConsignmentStore();
  const { shops, settlements, createSettlement } = state;
  const { error, setError, run } = useActionError();
  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [period, setPeriod] = useState(currentPeriod());

  const list = [...settlements].sort((a, b) =>
    a.period === b.period ? (a.createdAt < b.createdAt ? -1 : 1) : a.period < b.period ? 1 : -1
  );

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>月度对账</h1>
      <p style={{ color: C.muted, fontSize: 13 }}>
        每月按店开一张对账单：把对方报来的卖出、退货、店存逐款录入，
        系统与我方账上的「期初 + 送 − 退」核对，差在哪逐行列清。确认结账后相关送货/退货批次即锁定。
      </p>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>小店</label>
          <select style={inputStyle} value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">请选择…</option>
            {shops.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>账期（月份）</label>
          <input type="month" style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button
          style={btnPrimary}
          onClick={() =>
            run(() => {
              if (!shopId) throw new Error('请选择小店');
              const result = createSettlement(shopId, period);
              if (typeof result !== 'string') throw new Error(result.error);
              navigate(`/consignment/settlements/${result}`);
            })
          }
        >
          新建 / 打开对账单
        </button>
      </div>

      <div style={{ ...cardStyle, padding: 0, marginTop: 18, overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>账期</th>
              <th style={thStyle}>小店</th>
              <th style={thStyle}>状态</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>卖出</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>销售额</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>我方应得</th>
              <th style={thStyle}>差异</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {list.map((st) => {
              const shop = shops.find((s) => s.id === st.shopId);
              const totals = settlementTotals(st.lines);
              const isLast = latestConfirmed(state, st.shopId)?.id === st.id && st.status === 'confirmed';
              return (
                <tr key={st.id} style={{ background: st.status === 'draft' ? '#fffdf5' : undefined }}>
                  <td style={tdStyle}>{periodLabel(st.period)}</td>
                  <td style={tdStyle}>{shop?.name ?? '（已删除小店）'}</td>
                  <td style={tdStyle}>
                    {st.status === 'confirmed' ? (
                      <span style={{ color: C.primary }}>🔒 已结账{isLast ? '（最新）' : ''}</span>
                    ) : (
                      <span style={{ color: C.warn }}>📝 草稿</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{totals.sold} 件</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{money(totals.gross)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{money(totals.ourAmount)}</td>
                  <td style={tdStyle}>
                    {totals.discrepancyCount > 0 ? (
                      <span style={{ color: C.danger }}>{totals.discrepancyCount} 处待说明</span>
                    ) : (
                      <span style={{ color: C.ok }}>平</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button style={btnPrimary} onClick={() => navigate(`/consignment/settlements/${st.id}`)}>
                      {st.status === 'confirmed' ? '查看' : '继续对账'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: C.muted, padding: 28 }}>
                  还没有对账单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
