import { useState } from 'react';
import { useConsignmentStore } from '../../store/consignmentStore';
import { availableStock, money, onShopFloor, productLabel, today, totalStock } from '../../utils/consignment';
import {
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
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

export default function Products() {
  const state = useConsignmentStore();
  const { products, shops, stockIns, addProduct, changeProductPrice, addStockIn, deleteStockIn } = state;
  const { error, run, setError } = useActionError();

  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [tagPrice, setTagPrice] = useState(100);

  const [priceTarget, setPriceTarget] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState(0);
  const [priceReason, setPriceReason] = useState('');

  const [inProduct, setInProduct] = useState('');
  const [inQty, setInQty] = useState(1);
  const [inDate, setInDate] = useState(today());
  const [inNote, setInNote] = useState('');

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>款式 · 库存</h1>
      <p style={{ color: C.muted, fontSize: 13 }}>
        同一个款式、不同颜色分开记账；织好的成品先「入库」，送货时从手上库存扣，退回来的自动回到库存、可再送别家。
      </p>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 20, marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>新增款式</h2>
            <label style={labelStyle}>款式 *</label>
            <input style={{ ...inputStyle, width: '100%' }} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="如：云朵围巾" />
            <label style={{ ...labelStyle, marginTop: 10 }}>颜色 *</label>
            <input style={{ ...inputStyle, width: '100%' }} value={color} onChange={(e) => setColor(e.target.value)} placeholder="如：奶白" />
            <label style={{ ...labelStyle, marginTop: 10 }}>标价（元）*</label>
            <input
              type="number"
              min={0}
              style={{ ...inputStyle, width: '100%' }}
              value={tagPrice}
              onChange={(e) => setTagPrice(Number(e.target.value))}
            />
            <button
              style={{ ...btnPrimary, marginTop: 14, width: '100%' }}
              onClick={() =>
                run(() => {
                  if (!style.trim() || !color.trim()) throw new Error('款式和颜色必填');
                  if (!(tagPrice > 0)) throw new Error('标价必须大于 0');
                  addProduct({ style, color, tagPrice });
                  setStyle('');
                  setColor('');
                })
              }
            >
              添加款式
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>成品入库</h2>
            <label style={labelStyle}>款式</label>
            <select style={{ ...inputStyle, width: '100%' }} value={inProduct} onChange={(e) => setInProduct(e.target.value)}>
              <option value="">请选择…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {productLabel(p)}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>件数</label>
                <input type="number" min={1} style={{ ...inputStyle, width: '100%' }} value={inQty} onChange={(e) => setInQty(Number(e.target.value))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>日期</label>
                <input type="date" style={{ ...inputStyle, width: '100%' }} value={inDate} onChange={(e) => setInDate(e.target.value)} />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 10 }}>备注</label>
            <input style={{ ...inputStyle, width: '100%' }} value={inNote} onChange={(e) => setInNote(e.target.value)} />
            <button
              style={{ ...btnPrimary, marginTop: 14, width: '100%' }}
              onClick={() =>
                run(() => {
                  if (!inProduct) throw new Error('请选择款式');
                  addStockIn({ date: inDate, productId: inProduct, qty: inQty, note: inNote.trim() || undefined });
                  setInQty(1);
                  setInNote('');
                })
              }
            >
              入库
            </button>
          </div>
        </div>

        <div>
          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>款式 · 颜色</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>总入库</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>手上可用</th>
                  {shops.map((sh) => (
                    <th key={sh.id} style={{ ...thStyle, textAlign: 'right' }}>
                      {sh.name}
                    </th>
                  ))}
                  <th style={{ ...thStyle, textAlign: 'right' }}>标价</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{productLabel(p)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{totalStock(state, p.id)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{availableStock(state, p.id)}</td>
                    {shops.map((sh) => (
                      <td key={sh.id} style={{ ...tdStyle, textAlign: 'right' }}>
                        {onShopFloor(state, sh.id, p.id) || '—'}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(p.tagPrice)}</td>
                    <td style={tdStyle}>
                      <button
                        style={btnSmall}
                        onClick={() => {
                          setPriceTarget(p.id);
                          setNewPrice(p.tagPrice);
                          setPriceReason('');
                          setError(null);
                        }}
                      >
                        改价
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4 + shops.length} style={{ ...tdStyle, textAlign: 'center', color: C.muted, padding: 28 }}>
                      还没有款式
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 改价弹层 */}
          {priceTarget && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
              onClick={() => setPriceTarget(null)}
            >
              <div style={{ ...cardStyle, width: 380 }} onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const p = products.find((x) => x.id === priceTarget);
                  if (!p) return null;
                  return (
                    <>
                      <h2 style={{ fontSize: 15 }}>调整标价 · {productLabel(p)}</h2>
                      <div style={{ fontSize: 13, color: C.muted, margin: '6px 0 10px' }}>
                        当前 {money(p.tagPrice)}
                      </div>
                      <label style={labelStyle}>新价格（元）</label>
                      <input type="number" min={0} style={{ ...inputStyle, width: '100%' }} value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} />
                      <label style={{ ...labelStyle, marginTop: 10 }}>
                        改价说明 <span style={{ color: C.danger }}>*</span>
                      </label>
                      <textarea
                        style={{ ...inputStyle, width: '100%', minHeight: 64 }}
                        value={priceReason}
                        onChange={(e) => setPriceReason(e.target.value)}
                        placeholder="如：换季调价 / 合作店统一零售价"
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                        <button style={btnSmall} onClick={() => setPriceTarget(null)}>
                          取消
                        </button>
                        <button
                          style={btnPrimary}
                          onClick={() =>
                            run(() => {
                              changeProductPrice(priceTarget, newPrice, priceReason);
                              setPriceTarget(null);
                            })
                          }
                        >
                          确认改价
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>入库流水</h2>
          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>日期</th>
                  <th style={thStyle}>款式 · 颜色</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>件数</th>
                  <th style={thStyle}>备注</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {[...stockIns]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((si) => {
                    const p = products.find((x) => x.id === si.productId);
                    return (
                      <tr key={si.id}>
                        <td style={tdStyle}>{si.date}</td>
                        <td style={tdStyle}>{productLabel(p)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{si.qty}</td>
                        <td style={{ ...tdStyle, color: C.muted }}>{si.note ?? ''}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <button style={btnDanger} onClick={() => run(() => deleteStockIn(si.id))}>
                            删除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {stockIns.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: C.muted, padding: 24 }}>
                      还没有入库记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 改价历史 */}
          {products.some((p) => p.priceChanges.length > 0) && (
            <>
              <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>改价说明记录</h2>
              <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>时间</th>
                      <th style={thStyle}>款式</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>原价</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>新价</th>
                      <th style={thStyle}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .flatMap((p) => p.priceChanges.map((pc) => ({ p, pc })))
                      .sort((a, b) => (a.pc.at < b.pc.at ? 1 : -1))
                      .map(({ p, pc }, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>{new Date(pc.at).toLocaleString('zh-CN')}</td>
                          <td style={tdStyle}>{productLabel(p)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: C.muted }}>{money(pc.from)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{money(pc.to)}</td>
                          <td style={tdStyle}>{pc.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
