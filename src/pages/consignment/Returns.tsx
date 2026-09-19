import { useMemo, useState } from 'react';
import { useConsignmentStore } from '../../store/consignmentStore';
import { findSettlement, isReturnLocked, onShopFloor, productLabel, today } from '../../utils/consignment';
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

export default function Returns() {
  const state = useConsignmentStore();
  const { shops, products, returns: returnList, addReturn, updateReturnLine, updateReturnMeta, deleteReturn } = state;
  const { error, run, setError } = useActionError();

  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<{ productId: string; qty: number }[]>([]);
  const [note, setNote] = useState('');

  const sorted = useMemo(
    () =>
      [...returnList]
        .filter((r) => (shopId ? r.shopId === shopId : true))
        .sort((a, b) => (a.date < b.date ? 1 : a.createdAt < b.createdAt ? 1 : -1)),
    [returnList, shopId]
  );

  /** 这家店里现在有货的款，才能退 */
  const returnable = shopId
    ? products
        .map((p) => ({ p, floor: onShopFloor(state, shopId, p.id) }))
        .filter(({ floor }) => floor > 0)
    : [];

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>退货登记</h1>
      <p style={{ color: C.muted, fontSize: 13 }}>
        登记的是对方实际退回到手的件；退回后立即回到手上库存，可以再送去别家店。
      </p>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>小店 *</label>
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
            <label style={labelStyle}>退货到手日期</label>
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>备注</label>
            <input style={{ ...inputStyle, width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>款式 · 颜色</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>实际退回件数</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>店里现存</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = products.find((x) => x.id === r.productId);
                const floor = r.productId ? onShopFloor(state, shopId, r.productId) : 0;
                const over = r.qty > floor;
                return (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <select
                        style={inputStyle}
                        value={r.productId}
                        onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, productId: e.target.value, qty: 1 } : x)))}
                      >
                        <option value="">请选择…</option>
                        {returnable
                          .filter(({ p: rp }) => !rows.some((rr, j) => j !== i && rr.productId === rp.id))
                          .map(({ p: rp }) => (
                            <option key={rp.id} value={rp.id}>
                              {productLabel(rp)}（店里 {onShopFloor(state, shopId, rp.id)} 件）
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
                        onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))}
                      />
                      {over && <div style={{ color: C.danger, fontSize: 11 }}>店里只有 {floor} 件</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: C.muted }}>{p ? floor : ''}</td>
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
                  <td colSpan={4} style={{ ...tdStyle, color: C.muted, textAlign: 'center', padding: 18 }}>
                    {shopId ? '点下面「加一行」登记退货' : '请先选择小店'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button style={btnGhost} onClick={() => setRows((rs) => [...rs, { productId: '', qty: 1 }])} disabled={!shopId || returnable.length === 0}>
            + 加一行
          </button>
          <button
            style={btnPrimary}
            onClick={() =>
              run(() => {
                addReturn({ date, shopId, lines: rows.filter((r) => r.productId), note: note.trim() || undefined });
                setRows([]);
                setNote('');
              })
            }
          >
            登记退货
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>退货记录</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((r) => {
          const shop = shops.find((s) => s.id === r.shopId);
          const locked = isReturnLocked(r);
          const st = findSettlement(state, r.settlementId);
          return (
            <div key={r.id} style={{ ...cardStyle, padding: 0, borderColor: locked ? '#cfe8f7' : C.border }}>
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
                  <strong>{r.date}</strong> · {shop?.name ?? '（已删除小店）'}
                  {r.note && <span style={{ color: C.muted, marginLeft: 8 }}>{r.note}</span>}
                </div>
                {locked ? (
                  <span style={{ color: C.primary, fontSize: 12 }}>🔒 已结账{st ? `（${st.period}）` : ''}，不可修改</span>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="date"
                      style={{ ...inputStyle, fontSize: 12, padding: '3px 6px' }}
                      defaultValue={r.date}
                      onBlur={(e) => e.target.value !== r.date && run(() => updateReturnMeta(r.id, { date: e.target.value }))}
                    />
                    <button style={btnDanger} onClick={() => run(() => deleteReturn(r.id))}>
                      删除
                    </button>
                  </div>
                )}
              </div>
              <table style={tableStyle}>
                <tbody>
                  {r.lines.map((l) => {
                    const p = products.find((x) => x.id === l.productId);
                    return (
                      <tr key={l.productId}>
                        <td style={{ ...tdStyle, width: '40%' }}>{productLabel(p)}</td>
                        <td style={tdStyle}>
                          {locked ? (
                            `${l.qty} 件`
                          ) : (
                            <input
                              type="number"
                              min={0}
                              defaultValue={l.qty}
                              style={{ ...inputStyle, width: 70 }}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v !== l.qty) run(() => updateReturnLine(r.id, l.productId, v));
                              }}
                            />
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
        {sorted.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', color: C.muted, padding: 28 }}>还没有退货记录</div>
        )}
      </div>
    </div>
  );
}
