import { Fragment, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConsignmentStore } from '../../store/consignmentStore';
import {
  money,
  pendingMovements,
  periodEnd,
  periodLabel,
  productLabel,
  settlementTotals,
  shareLabel,
} from '../../utils/consignment';
import {
  pageStyle,
  cardStyle,
  inputStyle,
  btnPrimary,
  btnSmall,
  btnDanger,
  tableStyle,
  thStyle,
  tdStyle,
  C,
} from '../../components/consignment/ui';
import { ErrorBanner } from '../../components/consignment/Feedback';
import { useActionError } from '../../components/consignment/useActionError';
import type { SettlementLine } from '../../types/consignment';

export default function SettlementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useConsignmentStore();
  const {
    shops,
    products,
    deliveries,
    returns: returnList,
    updateSettlementReport,
    updateSettlementLinePrice,
    setDiscrepancyNote,
    confirmSettlement,
    deleteSettlement,
  } = state;
  const { error, run, setError } = useActionError();
  const [priceModal, setPriceModal] = useState<{ productId: string; price: number; ourShare: number; reason: string } | null>(null);

  const st = state.settlements.find((x) => x.id === id);

  const included = useMemo(() => {
    if (!st) return { deliveries: [], returns: [] };
    if (st.status === 'confirmed') {
      return {
        deliveries: deliveries.filter((d) => d.settlementId === st.id),
        returns: returnList.filter((r) => r.settlementId === st.id),
      };
    }
    // 草稿：截至本月底未结的送货/退货会自动并入
    return pendingMovements(state, st.shopId, periodEnd(st.period));
  }, [st, deliveries, returnList, state]);

  if (!st) {
    return (
      <div style={{ ...pageStyle, textAlign: 'center', paddingTop: 60 }}>
        <p>对账单不存在</p>
        <button style={btnPrimary} onClick={() => navigate('/consignment/settlements')}>
          返回对账列表
        </button>
      </div>
    );
  }

  const shop = shops.find((s) => s.id === st.shopId);
  const totals = settlementTotals(st.lines);
  const locked = st.status === 'confirmed';
  const report = (productId: string) => st.reports[productId] ?? { sold: 0, returned: 0, closing: 0 };

  const numInput = (
    value: number,
    onChange: (v: number) => void,
    highlight?: boolean
  ) =>
    locked ? (
      <span>{value}</span>
    ) : (
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        style={{
          width: 68,
          padding: '4px 6px',
          border: `1px solid ${highlight ? C.danger : C.border}`,
          borderRadius: 4,
          textAlign: 'right',
          fontSize: 13,
        }}
      />
    );

  return (
    <div style={pageStyle}>
      <button style={{ ...btnSmall, marginBottom: 10 }} onClick={() => navigate('/consignment/settlements')}>
        ← 返回列表
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20 }}>
          {periodLabel(st.period)} 对账单 · {shop?.name ?? '（已删除小店）'}
        </h1>
        {locked ? (
          <span style={{ color: C.primary, fontSize: 13 }}>
            🔒 已于 {st.confirmedAt ? new Date(st.confirmedAt).toLocaleString('zh-CN') : ''} 结账，整单及相关批次均不可修改
          </span>
        ) : (
          <span style={{ color: C.warn, fontSize: 13 }}>📝 草稿，随时可改；确认结账后锁定</span>
        )}
      </div>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* 本单涵盖的批次 */}
      <div style={{ ...cardStyle, marginTop: 12, fontSize: 13 }}>
        <strong>本单涵盖：</strong>
        <span style={{ marginLeft: 8 }}>
          {included.deliveries.length} 张送货单（{included.deliveries.map((d) => d.date).join('、') || '无'}），
          {included.returns.length} 张退货单（{included.returns.map((r) => r.date).join('、') || '无'}）
        </span>
        {!locked && (
          <div style={{ color: C.muted, marginTop: 4 }}>
            之后新登记、日期在本月底之前的未结送货/退货会自动并入本草稿。
          </div>
        )}
      </div>

      {/* 对账主表 */}
      <div style={{ ...cardStyle, padding: 0, marginTop: 14, overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {[
                '款式 · 颜色',
                '期初店存',
                '本期送',
                '我方实收退',
              ].map((h, i) => (
                <th
                  key={h}
                  rowSpan={2}
                  style={{
                    ...thStyle,
                    textAlign: i === 0 ? 'left' : 'right',
                  }}
                  title={i === 1 ? '上一张已结账单的期末店存' : undefined}
                >
                  {h}
                </th>
              ))}
              <th colSpan={3} style={{ ...thStyle, textAlign: 'center', background: '#f0f7fd' }}>
                对方报来（卖出 / 退货 / 月底店存）
              </th>
              {['我方账算店存', '单价', '分成(我:店)', '我方应得'].map((h) => (
                <th key={h} rowSpan={2} style={{ ...thStyle, textAlign: 'right' }} title={h === '我方账算店存' ? '期初 + 送 − 退 − 对方报卖' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
            <tr>
              {['卖出', '退货', '月底店存'].map((h) => (
                <th key={h} style={{ ...thStyle, textAlign: 'right', background: '#f0f7fd' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {st.lines.map((l: SettlementLine) => {
              const p = products.find((x) => x.id === l.productId);
              const r = report(l.productId);
              const hasDiff = l.discrepancies.length > 0;
              const lineEdit = st.lineEdits[l.productId];
              return (
                <Fragment key={l.productId}>
                  <tr style={{ background: hasDiff ? '#fdf3f2' : undefined }}>
                    <td style={tdStyle}>{productLabel(p)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{l.opening}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{l.delivered}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{l.returned}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', background: '#f7fbfe' }}>
                      {numInput(r.sold, (v) => updateSettlementReport(st.id, l.productId, { sold: v }), hasDiff)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', background: '#f7fbfe' }}>
                      {numInput(r.returned, (v) => updateSettlementReport(st.id, l.productId, { returned: v }), hasDiff)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', background: '#f7fbfe' }}>
                      {numInput(r.closing, (v) => updateSettlementReport(st.id, l.productId, { closing: v }), hasDiff)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: hasDiff ? C.danger : undefined }}>
                      {l.bookClosing}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {money(l.price)}
                      {!locked && (
                        <button
                          style={{ ...btnSmall, marginLeft: 6, padding: '1px 6px' }}
                          onClick={() =>
                            setPriceModal({
                              productId: l.productId,
                              price: l.price,
                              ourShare: l.ourShare,
                              reason: '',
                            })
                          }
                        >
                          改
                        </button>
                      )}
                      {lineEdit?.priceChanges && lineEdit.priceChanges.length > 0 && (
                        <span style={{ color: C.warn, fontSize: 11, marginLeft: 4 }} title={lineEdit.priceChanges.map((pc) => `${money(pc.from)}→${money(pc.to)}：${pc.reason}`).join('\n')}>
                          ⓘ
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{shareLabel(l.ourShare)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{money(l.ourAmount)}</td>
                  </tr>
                  {hasDiff &&
                    l.discrepancies.map((d, i) => (
                      <tr key={`${l.productId}-d${i}`} style={{ background: '#fdf3f2' }}>
                        <td colSpan={11} style={{ ...tdStyle, color: C.danger, fontSize: 12, paddingLeft: 28 }}>
                          ⚠️ {d.message}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {st.lines.length === 0 && (
              <tr>
                <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', color: C.muted, padding: 28 }}>
                  本月该店没有进出，也没有期初库存
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#fcfbfa', fontWeight: 600 }}>
              <td style={tdStyle}>合计</td>
              <td colSpan={3} style={tdStyle} />
              <td style={{ ...tdStyle, textAlign: 'right' }}>{totals.sold} 件</td>
              <td colSpan={2} style={tdStyle} />
              <td style={tdStyle} />
              <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>
                销售额 {money(totals.gross)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <span style={{ color: C.primary }}>{money(totals.ourAmount)}</span>
                <span style={{ display: 'block', fontSize: 11, color: C.muted, fontWeight: 400 }}>
                  店方 {money(totals.shopAmount)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 差异处理说明 */}
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>
          差异处理说明 {totals.discrepancyCount > 0 && <span style={{ color: C.danger }}>*（有 {totals.discrepancyCount} 处差异，结账前必填）</span>}
        </label>
        {locked ? (
          <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap', background: C.paper, padding: 10, borderRadius: 4, border: `1px solid ${C.border}` }}>
            {st.discrepancyNote || '（无差异，无说明）'}
          </div>
        ) : (
          <textarea
            style={{ ...inputStyle, width: '100%', minHeight: 70, marginTop: 8 }}
            value={st.discrepancyNote}
            onChange={(e) => setDiscrepancyNote(st.id, e.target.value)}
            placeholder="如：报店存比账上少 1 件，对方承认卖漏登记，下月补款；报退 2 件实际到 1 件，另 1 件在途，下月核。"
          />
        )}
      </div>

      {!locked && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            style={btnDanger}
            onClick={() => {
              if (confirm('删除这张草稿？被它占用的送货/退货批次会恢复为未结状态。')) {
                deleteSettlement(st.id);
                navigate('/consignment/settlements');
              }
            }}
          >
            删除草稿
          </button>
          <button
            style={{ ...btnPrimary, padding: '10px 24px' }}
            onClick={() =>
              run(() => {
                const res = confirmSettlement(st.id);
                if (res && 'error' in res) throw new Error(res.error);
                navigate('/consignment/settlements');
              })
            }
          >
            确认结账并锁定
          </button>
        </div>
      )}

      {/* 行内改价/改分成弹层 */}
      {priceModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setPriceModal(null)}
        >
          <div style={{ ...cardStyle, width: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 15 }}>
              调整本单价 · {productLabel(products.find((p) => p.id === priceModal.productId))}
            </h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 10px' }}>
              只影响这张对账单的结算金额，不改动原始送货单价格。
            </p>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>
              结算单价（元）
            </label>
            <input
              type="number"
              min={0}
              style={{ ...inputStyle, width: '100%' }}
              value={priceModal.price}
              onChange={(e) => setPriceModal({ ...priceModal, price: Number(e.target.value) })}
            />
            <label style={{ fontSize: 12, color: C.muted, display: 'block', margin: '10px 0 4px' }}>
              分成（我方比例）
            </label>
            <select
              style={{ ...inputStyle, width: '100%' }}
              value={priceModal.ourShare}
              onChange={(e) => setPriceModal({ ...priceModal, ourShare: Number(e.target.value) })}
            >
              {[0.5, 0.55, 0.6, 0.65, 0.7, 0.8].map((v) => (
                <option key={v} value={v}>
                  {shareLabel(v)}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 12, color: C.danger, display: 'block', margin: '10px 0 4px' }}>
              改价说明 *（价格变了必填；只改分成可留空）
            </label>
            <textarea
              style={{ ...inputStyle, width: '100%', minHeight: 60 }}
              value={priceModal.reason}
              onChange={(e) => setPriceModal({ ...priceModal, reason: e.target.value })}
              placeholder="如：这批按店庆活动价 100 元结"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button style={btnSmall} onClick={() => setPriceModal(null)}>
                取消
              </button>
              <button
                style={btnPrimary}
                onClick={() =>
                  run(() => {
                    updateSettlementLinePrice(
                      st.id,
                      priceModal.productId,
                      { price: priceModal.price, ourShare: priceModal.ourShare },
                      priceModal.reason
                    );
                    setPriceModal(null);
                  })
                }
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
