import { useMemo, useState } from 'react';
import { ConsignmentError, useConsignmentStore } from '../../store/consignmentStore';
import { onHandStock, today } from '../../utils/consignment';
import { Field, Notice, Table } from './ui';
import { cardStyle, inputStyle, primaryBtn, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

export default function InventoryTab() {
  const styles = useConsignmentStore((s) => s.styles);
  const colors = useConsignmentStore((s) => s.colors);
  const movements = useConsignmentStore((s) => s.movements);
  const deliveries = useConsignmentStore((s) => s.deliveries);
  const store = useConsignmentStore();
  const addProduce = useConsignmentStore((s) => s.addProduce);
  const { styleName, colorName } = useConsignNames();

  const [date, setDate] = useState(today());
  const [styleId, setStyleId] = useState('');
  const [colorId, setColorId] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const onHand = useMemo(
    () => onHandStock({ ...store, movements, deliveries }),
    [store, movements, deliveries],
  );
  const rows = [...onHand.entries()].filter(([, n]) => n !== 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 4px' }}>织好成品入库</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
          织好一件记一笔；店家退回的货系统会自动回库，不用在这里登记。
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
            <input type="number" min={1} style={{ ...inputStyle, width: 80 }} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </Field>
          <Field label="备注">
            <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填" />
          </Field>
          <button
            style={primaryBtn}
            onClick={() => {
              setError('');
              setOk('');
              try {
                if (!styleId || !colorId) throw new ConsignmentError('请选款式和颜色');
                if (!date) throw new ConsignmentError('请选日期');
                addProduce({ date, styleId, colorId, qty, note: note.trim() || undefined });
                setOk(`已入库 ${qty} 件`);
                setNote('');
              } catch (e) {
                setError(e instanceof ConsignmentError ? e.message : String(e));
              }
            }}
          >
            登记入库
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>手头可送库存</h3>
        <Table headers={['款式', '颜色', '手头件数']}>
          {rows.map(([key, n]) => {
            const [sid, cid] = key.split('|');
            return (
              <tr key={key}>
                <td style={tdStyle()}>{styleName(sid)}</td>
                <td style={tdStyle()}>{colorName(cid)}</td>
                <td style={{ ...tdStyle(), fontWeight: 600, color: n < 0 ? '#e74c3c' : undefined }}>{n} 件{n < 0 && '（数据异常）'}</td>
              </tr>
            );
          })}
        </Table>
        {rows.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>手头还没有货，先在上面登记织好的成品。</p>}
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
          手头 = 织好入库 + 各店退回回收 − 已送出；同一个款式/颜色送不同店时库存分别扣减，退货回来可以再送别家。
        </p>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>入库流水</h3>
        <Table headers={['日期', '款式', '颜色', '件数', '来源', '备注']}>
          {[...movements].reverse().map((m) => (
            <tr key={m.id}>
              <td style={tdStyle()}>{m.date}</td>
              <td style={tdStyle()}>{styleName(m.styleId)}</td>
              <td style={tdStyle()}>{colorName(m.colorId)}</td>
              <td style={tdStyle()}>{m.qty}</td>
              <td style={tdStyle()}>{m.type === 'produce' ? '织好入库' : '退货回收'}</td>
              <td style={tdStyle()}>{m.note ?? ''}</td>
            </tr>
          ))}
        </Table>
        {movements.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>暂无记录</p>}
      </section>
    </div>
  );
}
