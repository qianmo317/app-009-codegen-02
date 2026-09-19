import { useMemo, useState } from 'react';
import { ConsignmentError, useConsignmentStore } from '../../store/consignmentStore';
import type { DeliveryLine } from '../../types/consignment';
import { isMonthLocked, monthOf, onHandStock, stockKey, today } from '../../utils/consignment';
import { Field, Notice, Table } from './ui';
import { cardStyle, dangerBtn, ghostBtn, inputStyle, primaryBtn, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

interface DraftLine {
  styleId: string;
  colorId: string;
  qty: number;
  unitPrice: number;
}

const emptyLine: DraftLine = { styleId: '', colorId: '', qty: 1, unitPrice: 0 };

export default function DeliveriesTab() {
  const state = useConsignmentStore();
  const { shopName, styleName, colorName, shops, styles, colors } = useConsignNames();
  const addDelivery = useConsignmentStore((s) => s.addDelivery);
  const updateDelivery = useConsignmentStore((s) => s.updateDelivery);
  const deleteDelivery = useConsignmentStore((s) => s.deleteDelivery);

  const [shopId, setShopId] = useState('');
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // 编辑态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceReason, setPriceReason] = useState('');

  const onHand = useMemo(() => onHandStock(state), [state]);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setDraft((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const resetForm = () => {
    setEditingId(null);
    setShopId('');
    setDate(today());
    setDraft([{ ...emptyLine }]);
    setPriceReason('');
  };

  const submit = () => {
    setError('');
    setOk('');
    try {
      if (!shopId) throw new ConsignmentError('请选择店铺');
      if (!date) throw new ConsignmentError('请选择日期');
      const lines: DeliveryLine[] = draft
        .filter((l) => l.styleId && l.colorId && l.qty > 0)
        .map((l) => ({ styleId: l.styleId, colorId: l.colorId, qty: l.qty, unitPrice: l.unitPrice }));
      // 同 SKU 不允许两行
      const seen = new Set<string>();
      for (const l of lines) {
        const k = stockKey(l.styleId, l.colorId);
        if (seen.has(k)) throw new ConsignmentError('同一送货单里同一款式/颜色只能写一行，请合并件数');
        seen.add(k);
      }
      if (lines.length === 0) throw new ConsignmentError('请至少填写一行明细');
      if (editingId) {
        updateDelivery(editingId, { date, lines }, priceReason);
        setOk('送货单已修改');
      } else {
        addDelivery({ shopId, date, lines });
        setOk('送货单已登记');
      }
      resetForm();
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  const startEdit = (id: string) => {
    const d = state.deliveries.find((x) => x.id === id);
    if (!d) return;
    setError('');
    setOk('');
    setEditingId(id);
    setShopId(d.shopId);
    setDate(d.date);
    setDraft(d.lines.map((l) => ({ ...l })));
    setPriceReason('');
  };

  const deliveries = [...state.deliveries].sort((a, b) => (a.date < b.date ? 1 : -1));
  // 编辑时库存要把原单据占用的量还回去
  const editing = editingId ? state.deliveries.find((d) => d.id === editingId) : null;
  const availableFor = (styleId: string, colorId: string): number => {
    const base = onHand.get(stockKey(styleId, colorId)) ?? 0;
    if (!editing) return base;
    const old = editing.lines.find((l) => l.styleId === styleId && l.colorId === colorId);
    return base + (old?.qty ?? 0);
  };

  // 是否有改价（决定是否展示说明输入框）
  const hasPriceChange = editing
    ? draft.some((l) => {
        const o = editing.lines.find((x) => x.styleId === l.styleId && x.colorId === l.colorId);
        return o && o.unitPrice !== l.unitPrice;
      })
    : false;

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      {shops.length === 0 && <Notice kind="info">先到「基础资料」里添加寄卖的小店、款式和颜色。</Notice>}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>{editingId ? '修改送货单' : '新增送货单'}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <Field label="送到哪家店">
            <select style={inputStyle} value={shopId} disabled={!!editingId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">请选择</option>
              {shops.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
            </select>
          </Field>
          <Field label="送货日期">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Table headers={['款式', '颜色', '件数', '约定售价（元/件）', '手头可用', '']}>
          {draft.map((l, i) => (
            <tr key={i}>
              <td style={tdStyle()}>
                <select style={inputStyle} value={l.styleId} onChange={(e) => setLine(i, { styleId: e.target.value })}>
                  <option value="">请选择</option>
                  {styles.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </td>
              <td style={tdStyle()}>
                <select style={inputStyle} value={l.colorId} onChange={(e) => setLine(i, { colorId: e.target.value })}>
                  <option value="">请选择</option>
                  {colors.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
              </td>
              <td style={tdStyle()}>
                <input type="number" min={1} style={{ ...inputStyle, width: 72 }} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
              </td>
              <td style={tdStyle()}>
                <input type="number" min={0} step="0.01" style={{ ...inputStyle, width: 96 }} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} />
              </td>
              <td style={{ ...tdStyle(), color: '#888' }}>
                {l.styleId && l.colorId ? `${availableFor(l.styleId, l.colorId)} 件` : '—'}
              </td>
              <td style={tdStyle()}>
                {draft.length > 1 && (
                  <button style={dangerBtn} onClick={() => setDraft((ls) => ls.filter((_, idx) => idx !== i))}>删行</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <div style={{ marginTop: 8 }}>
          <button style={ghostBtn} onClick={() => setDraft((ls) => [...ls, { ...emptyLine }])}>+ 加一行（另一个款式/颜色）</button>
        </div>

        {(hasPriceChange || priceReason) && (
          <div style={{ marginTop: 12 }}>
            <Field label="改价说明（改价必须写清原因，结账后永久留档）">
              <textarea style={{ ...inputStyle, minHeight: 56 }} value={priceReason} onChange={(e) => setPriceReason(e.target.value)} placeholder="如：换季促销，店家要求降到 80 一件" />
            </Field>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <button style={primaryBtn} onClick={submit}>{editingId ? '保存修改' : '登记送货'}</button>
          {editingId && <button style={ghostBtn} onClick={resetForm}>取消编辑</button>}
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>送货记录</h3>
        <Table headers={['日期', '店铺', '明细', '合计件数', '状态', '操作']}>
          {deliveries.map((d) => {
            const locked = isMonthLocked(state, d.shopId, d.date);
            const total = d.lines.reduce((a, l) => a + l.qty, 0);
            return (
              <tr key={d.id}>
                <td style={tdStyle()}>{d.date}</td>
                <td style={tdStyle()}>{shopName(d.shopId)}</td>
                <td style={tdStyle()}>
                  {d.lines.map((l) => (
                    <div key={stockKey(l.styleId, l.colorId)}>
                      {styleName(l.styleId)} / {colorName(l.colorId)} × {l.qty}件@{l.unitPrice}元
                    </div>
                  ))}
                </td>
                <td style={tdStyle()}>{total}</td>
                <td style={tdStyle()}>
                  {locked ? (
                    <span style={{ color: '#8c6f4e', fontWeight: 600 }}>🔒 {monthOf(d.date)} 已结账</span>
                  ) : (
                    <span style={{ color: '#999' }}>可修改</span>
                  )}
                </td>
                <td style={tdStyle()}>
                  {!locked && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button style={ghostBtn} onClick={() => startEdit(d.id)}>改</button>
                      <button
                        style={dangerBtn}
                        onClick={() => {
                          try {
                            deleteDelivery(d.id);
                            if (editingId === d.id) resetForm();
                          } catch (e) {
                            setError(e instanceof ConsignmentError ? e.message : String(e));
                          }
                        }}
                      >
                        删
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        {deliveries.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>还没有送过货</p>}
      </section>
    </div>
  );
}
