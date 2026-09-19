import { useMemo, useState } from 'react';
import { useConsignmentStore } from '../../store/consignmentStore';
import {
  availableStock,
  findSettlement,
  isDeliveryLocked,
  money,
  productLabel,
  shareLabel,
  today,
} from '../../utils/consignment';
import {
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSmall,
  btnDanger,
  btnGhost,
  tableStyle,
  thStyle,
  tdStyle,
  C,
} from '../../components/consignment/ui';
import { ErrorBanner } from '../../components/consignment/Feedback';
import { useActionError } from '../../components/consignment/useActionError';

type DraftRow = { productId: string; qty: number; price: number; ourShare: number };

export default function Deliveries() {
  const state = useConsignmentStore();
  const { shops, products, deliveries, addDelivery, updateDeliveryLine, updateDeliveryMeta, deleteDelivery } = state;
  const { error, run, setError } = useActionError();

  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [note, setNote] = useState('');

  const [priceEdit, setPriceEdit] = useState<{ deliveryId: string; productId: string; price: number; reason: string } | null>(null);

  const selectedShop = shops.find((s) => s.id === shopId);

  const sortedDeliveries = useMemo(
    () =>
      [...deliveries]
        .filter((d) => (shopId ? d.shopId === shopId : true))
        .sort((a, b) => (a.date < b.date ? 1 : a.createdAt < b.createdAt ? 1 : -1)),
    [deliveries, shopId]
  );

  const setRow = (i: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    const p = products.find((x) => !rows.some((r) => r.productId === x.id));
    if (!p) return;
    setRows((rs) => [
      ...rs,
      { productId: p.id, qty: 1, price: p.tagPrice, ourShare: selectedShop?.defaultOurShare ?? 0.6 },
    ]);
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>送货登记</h1>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>小店 *</label>
            <select style={inputStyle} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">请选择…</option>
              {shops.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name}（默认分成 {shareLabel(sh.defaultOurShare)}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>送货日期</label>
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>备注</label>
            <input style={{ ...inputStyle, width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：随单附一张价格签" />
          </div>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>款式 · 颜色</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>件数</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>约定售价</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 150 }}>我方分成</th>
                <th style={{ ...thStyle, width: 110 }}>手上可用</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const avail = availableStock(state, r.productId);
                const over = r.qty > avail;
                return (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <select
                        style={inputStyle}
                        value={r.productId}
                        onChange={(e) => {
                          const np = products.find((x) => x.id === e.target.value);
                          setRow(i, {
                            productId: e.target.value,
                            price: np?.tagPrice ?? r.price,
                            ourShare: selectedShop?.defaultOurShare ?? r.ourShare,
                          });
                        }}
                      >
                        {products.map((x) => (
                          <option key={x.id} value={x.id} disabled={rows.some((rr, j) => j !== i && rr.productId === x.id)}>
                            {productLabel(x)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <input
                        type="number"
                        min={1}
                        style={{ ...inputStyle, width: 70, textAlign: 'right', borderColor: over ? C.danger : undefined }}
                        value={r.qty}
                        onChange={(e) => setRow(i, { qty: Number(e.target.value) })}
                      />
                      {over && <div style={{ color: C.danger, fontSize: 11 }}>只剩 {avail} 件</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...inputStyle, width: 90, textAlign: 'right' }}
                        value={r.price}
                        onChange={(e) => setRow(i, { price: Number(e.target.value) })}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <select
                        style={{ ...inputStyle, width: 130 }}
                        value={r.ourShare}
                        onChange={(e) => setRow(i, { ourShare: Number(e.target.value) })}
                      >
                        {[0.5, 0.55, 0.6, 0.65, 0.7, 0.8].map((v) => (
                          <option key={v} value={v}>
                            我 {Math.round(v * 100)}% · 店 {Math.round((1 - v) * 100)}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: over ? C.danger : C.muted }}>{avail}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button style={btnSmall} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        移除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: C.muted, textAlign: 'center', padding: 18 }}>
                    点下面「加一行」选择要送的款
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button style={btnGhost} onClick={addRow} disabled={!shopId || products.length === 0}>
            + 加一行
          </button>
          <button
            style={btnPrimary}
            onClick={() =>
              run(() => {
                addDelivery({ date, shopId, lines: rows, note: note.trim() || undefined });
                setRows([]);
                setNote('');
              })
            }
          >
            登记这一批送货
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>送货记录{shopId ? ` · ${selectedShop?.name}` : ' · 全部小店'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedDeliveries.map((d) => {
          const shop = shops.find((s) => s.id === d.shopId);
          const locked = isDeliveryLocked(d);
          const st = findSettlement(state, d.settlementId);
          return (
            <div key={d.id} style={{ ...cardStyle, padding: 0, borderColor: locked ? '#cfe8f7' : C.border }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 14px',
                  background: locked ? '#f4fafe' : '#fcfbfa',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{d.date}</strong> · {shop?.name ?? '（已删除小店）'}
                  {d.note && <span style={{ color: C.muted, marginLeft: 8 }}>{d.note}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {locked ? (
                    <span style={{ color: C.primary, fontSize: 12 }}>
                      🔒 已结账{st ? `（${st.period}）` : ''}，不可修改
                    </span>
                  ) : (
                    <>
                      <input
                        type="date"
                        style={{ ...inputStyle, fontSize: 12, padding: '3px 6px' }}
                        defaultValue={d.date}
                        onBlur={(e) => e.target.value !== d.date && run(() => updateDeliveryMeta(d.id, { date: e.target.value }))}
                      />
                      <button style={btnDanger} onClick={() => run(() => deleteDelivery(d.id))}>
                        删除整批
                      </button>
                    </>
                  )}
                </div>
              </div>
              <table style={tableStyle}>
                <tbody>
                  {d.lines.map((l) => {
                    const p = products.find((x) => x.id === l.productId);
                    return (
                      <tr key={l.productId}>
                        <td style={{ ...tdStyle, width: '30%' }}>{productLabel(p)}</td>
                        <td style={{ ...tdStyle, width: 70 }}>
                          {locked ? (
                            `${l.qty} 件`
                          ) : (
                            <input
                              type="number"
                              min={0}
                              defaultValue={l.qty}
                              style={{ ...inputStyle, width: 64 }}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v !== l.qty) run(() => updateDeliveryLine(d.id, l.productId, { qty: v }));
                              }}
                            />
                          )}
                        </td>
                        <td style={tdStyle}>
                          {money(l.price)}
                          {!locked && (
                            <button
                              style={{ ...btnSmall, marginLeft: 8 }}
                              onClick={() =>
                                setPriceEdit({ deliveryId: d.id, productId: l.productId, price: l.price, reason: '' })
                              }
                            >
                              改价
                            </button>
                          )}
                          {l.priceChanges.length > 0 && (
                            <span title={l.priceChanges.map((pc) => `${new Date(pc.at).toLocaleDateString('zh-CN')}：${money(pc.from)}→${money(pc.to)}（${pc.reason}）`).join('\n')}>
                              {' '}
                              <span style={{ color: C.warn, fontSize: 11, cursor: 'help' }}>
                                改过 {l.priceChanges.length} 次价 ⓘ
                              </span>
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: C.muted }}>
                          {locked ? (
                            shareLabel(l.ourShare)
                          ) : (
                            <select
                              style={{ ...inputStyle, fontSize: 12 }}
                              defaultValue={l.ourShare}
                              onChange={(e) =>
                                run(() => updateDeliveryLine(d.id, l.productId, { ourShare: Number(e.target.value) }))
                              }
                            >
                              {[0.5, 0.55, 0.6, 0.65, 0.7, 0.8].map((v) => (
                                <option key={v} value={v}>
                                  {shareLabel(v)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        {sortedDeliveries.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', color: C.muted, padding: 28 }}>还没有送货记录</div>
        )}
      </div>

      {/* 送货批改价 */}
      {priceEdit && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setPriceEdit(null)}
        >
          <div style={{ ...cardStyle, width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 15 }}>改这批的约定售价</h2>
            <label style={{ ...labelStyle, marginTop: 8 }}>新价格（元）</label>
            <input
              type="number"
              min={0}
              style={{ ...inputStyle, width: '100%' }}
              value={priceEdit.price}
              onChange={(e) => setPriceEdit({ ...priceEdit, price: Number(e.target.value) })}
            />
            <label style={{ ...labelStyle, marginTop: 10 }}>
              改价说明 <span style={{ color: C.danger }}>*</span>
            </label>
            <textarea
              style={{ ...inputStyle, width: '100%', minHeight: 64 }}
              value={priceEdit.reason}
              onChange={(e) => setPriceEdit({ ...priceEdit, reason: e.target.value })}
              placeholder="如：这家谈好的活动价"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button style={btnSmall} onClick={() => setPriceEdit(null)}>
                取消
              </button>
              <button
                style={btnPrimary}
                onClick={() =>
                  run(() => {
                    updateDeliveryLine(priceEdit.deliveryId, priceEdit.productId, { price: priceEdit.price }, priceEdit.reason);
                    setPriceEdit(null);
                  })
                }
              >
                确认改价
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
