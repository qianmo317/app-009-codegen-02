import { useMemo, useState } from 'react';
import { ConsignmentError, useConsignmentStore } from '../../store/consignmentStore';
import { isMonthLocked, monthOf, shopCurrentStock, stockKey, today } from '../../utils/consignment';
import { Field, Notice, Table } from './ui';
import { cardStyle, dangerBtn, inputStyle, primaryBtn, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

export default function ReturnsTab() {
  const state = useConsignmentStore();
  const { shops, styles, colors, shopName, styleName, colorName } = useConsignNames();
  const addReturn = useConsignmentStore((s) => s.addReturn);
  const deleteReturn = useConsignmentStore((s) => s.deleteReturn);

  const [shopId, setShopId] = useState('');
  const [date, setDate] = useState(today());
  const [styleId, setStyleId] = useState('');
  const [colorId, setColorId] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const stock = useMemo(() => (shopId ? shopCurrentStock(state, shopId) : new Map<string, number>()), [state, shopId]);
  const inShop = styleId && colorId ? stock.get(stockKey(styleId, colorId)) ?? 0 : null;

  const submit = () => {
    setError('');
    setOk('');
    try {
      if (!shopId || !styleId || !colorId) throw new ConsignmentError('请选店铺、款式、颜色');
      addReturn({ shopId, date, styleId, colorId, qty, note: note.trim() || undefined });
      setOk('退货已登记，货品自动回库，可以重新送到别家');
      setQty(1);
      setNote('');
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  const returns = [...state.returns].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 4px' }}>登记退货</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
          没卖掉的货退回来；留在店里接着卖的不用登记。退回后自动回到手头库存，随时可以另开送货单送到别家。
        </p>
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
          <Field label="备注">
            <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填" />
          </Field>
        </div>
        {inShop !== null && (
          <p style={{ fontSize: 13, color: inShop > 0 ? '#666' : '#e74c3c', margin: '8px 0' }}>
            该店当前在店：{inShop} 件{qty > inShop ? '，退货数超过在店数' : ''}
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <button style={primaryBtn} onClick={submit}>登记退货并回库</button>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>退货记录</h3>
        <Table headers={['日期', '店铺', '款式 / 颜色', '件数', '状态', '']}>
          {returns.map((r) => {
            const locked = isMonthLocked(state, r.shopId, r.date);
            return (
              <tr key={r.id}>
                <td style={tdStyle()}>{r.date}</td>
                <td style={tdStyle()}>{shopName(r.shopId)}</td>
                <td style={tdStyle()}>{styleName(r.styleId)} / {colorName(r.colorId)}</td>
                <td style={tdStyle()}>{r.qty}</td>
                <td style={tdStyle()}>{locked ? <span style={{ color: '#8c6f4e' }}>🔒 {monthOf(r.date)} 已结账</span> : <span style={{ color: '#3c763d' }}>已回库</span>}</td>
                <td style={tdStyle()}>
                  {!locked && (
                    <button
                      style={dangerBtn}
                      onClick={() => {
                        try {
                          deleteReturn(r.id);
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
        {returns.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>还没有退货</p>}
      </section>
    </div>
  );
}
