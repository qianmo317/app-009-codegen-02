import { useMemo, useState } from 'react';
import { ConsignmentError, useConsignmentStore } from '../../store/consignmentStore';
import { isMonthLocked, shopCurrentStock, stockKey, today } from '../../utils/consignment';
import { Field, Notice, Table } from './ui';
import { cardStyle, dangerBtn, inputStyle, primaryBtn, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

export default function SalesTab() {
  const state = useConsignmentStore();
  const { shops, styles, colors, shopName, styleName, colorName } = useConsignNames();
  const addSale = useConsignmentStore((s) => s.addSale);
  const deleteSale = useConsignmentStore((s) => s.deleteSale);

  const [shopId, setShopId] = useState('');
  const [date, setDate] = useState(today());
  const [styleId, setStyleId] = useState('');
  const [colorId, setColorId] = useState('');
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // 各店当前在店库存
  const shopStocks = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const sh of shops) m.set(sh.id, shopCurrentStock(state, sh.id));
    return m;
  }, [state, shops]);

  const agreedPrice = useMemo(() => {
    if (!shopId || !styleId || !colorId) return null;
    const hits = state.deliveries
      .filter((d) => d.shopId === shopId)
      .flatMap((d) =>
        d.lines.filter((l) => l.styleId === styleId && l.colorId === colorId).map((l) => ({ date: d.date, price: l.unitPrice })),
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return hits[0]?.price ?? null;
  }, [state.deliveries, shopId, styleId, colorId]);

  const inShop = shopId && styleId && colorId ? shopStocks.get(shopId)?.get(stockKey(styleId, colorId)) ?? 0 : null;
  const priceMismatch = agreedPrice !== null && unitPrice !== agreedPrice;

  const submit = () => {
    setError('');
    setOk('');
    try {
      if (!shopId || !styleId || !colorId) throw new ConsignmentError('请选店铺、款式、颜色');
      addSale({ shopId, date, styleId, colorId, qty, unitPrice }, reason);
      setOk('售出已登记');
      setQty(1);
      setReason('');
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  const sales = [...state.sales].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const shopRate = (id: string) => shops.find((x) => x.id === id)?.commissionRate ?? 0;

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>登记卖出</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="店铺">
            <select style={inputStyle} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">请选择</option>
              {shops.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
            </select>
          </Field>
          <Field label="日期">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="款式">
            <select style={inputStyle} value={styleId} onChange={(e) => setStyleId(e.target.value)}>
              <option value="">请选择</option>
              {styles.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </Field>
          <Field label="颜色">
            <select style={inputStyle} value={colorId} onChange={(e) => setColorId(e.target.value)}>
              <option value="">请选择</option>
              {colors.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </select>
          </Field>
          <Field label="件数">
            <input type="number" min={1} style={{ ...inputStyle, width: 72 }} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </Field>
          <Field label={`实际成交价${agreedPrice !== null ? `（约定价 ${agreedPrice}）` : ''}`}>
            <input type="number" min={0} step="0.01" style={{ ...inputStyle, width: 100 }} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
          </Field>
        </div>
        {inShop !== null && (
          <p style={{ fontSize: 13, color: inShop > 0 ? '#666' : '#e74c3c', margin: '8px 0' }}>
            该店当前在店：{inShop} 件。分成：店家 {Math.round(shopRate(shopId) * 100)}%，我方 {(100 - Math.round(shopRate(shopId) * 100))}%。
          </p>
        )}
        {priceMismatch && (
          <Field label={`改价说明（成交价 ${unitPrice} ≠ 约定价 ${agreedPrice}，必须写清原因）`}>
            <textarea style={{ ...inputStyle, minHeight: 56 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：老顾客抹零 / 微瑕疵特价" />
          </Field>
        )}
        <div style={{ marginTop: 12 }}>
          <button style={primaryBtn} onClick={submit}>登记售出</button>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>售出记录</h3>
        <Table headers={['日期', '店铺', '款式 / 颜色', '件数', '成交价', '销售额', '状态', '']}>
          {sales.map((s) => {
            const locked = isMonthLocked(state, s.shopId, s.date);
            const hasAdj = state.adjustments.some((a) => a.kind === 'sale' && a.refId === s.id);
            return (
              <tr key={s.id}>
                <td style={tdStyle()}>{s.date}</td>
                <td style={tdStyle()}>{shopName(s.shopId)}</td>
                <td style={tdStyle()}>{styleName(s.styleId)} / {colorName(s.colorId)}</td>
                <td style={tdStyle()}>{s.qty}</td>
                <td style={tdStyle()}>{s.unitPrice}{hasAdj && <span style={{ color: '#c08a3e', marginLeft: 4 }} title="有改价说明">⚠</span>}</td>
                <td style={tdStyle()}>{(s.qty * s.unitPrice).toFixed(2)}</td>
                <td style={tdStyle()}>{locked ? <span style={{ color: '#8c6f4e' }}>🔒 已结账</span> : <span style={{ color: '#999' }}>可改</span>}</td>
                <td style={tdStyle()}>
                  {!locked && (
                    <button
                      style={dangerBtn}
                      onClick={() => {
                        try {
                          deleteSale(s.id);
                        } catch (e) {
                          setError(e instanceof ConsignmentError ? e.message : String(e));
                        }
                      }}
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        {sales.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>还没有售出记录</p>}
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
          同一款式送了几家店时，按所选店铺分别记账，互不混算。
        </p>
      </section>
    </div>
  );
}
