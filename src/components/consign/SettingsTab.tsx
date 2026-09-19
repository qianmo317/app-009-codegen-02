import { useState } from 'react';
import { useConsignmentStore, ConsignmentError } from '../../store/consignmentStore';
import { Field, Notice, Table } from './ui';
import { cardStyle, dangerBtn, ghostBtn, inputStyle, primaryBtn, tdStyle } from './uiStyles';

export default function SettingsTab() {
  const shops = useConsignmentStore((s) => s.shops);
  const styles = useConsignmentStore((s) => s.styles);
  const colors = useConsignmentStore((s) => s.colors);
  const addShop = useConsignmentStore((s) => s.addShop);
  const updateShop = useConsignmentStore((s) => s.updateShop);
  const deleteShop = useConsignmentStore((s) => s.deleteShop);
  const addStyle = useConsignmentStore((s) => s.addStyle);
  const deleteStyle = useConsignmentStore((s) => s.deleteStyle);
  const addColor = useConsignmentStore((s) => s.addColor);
  const deleteColor = useConsignmentStore((s) => s.deleteColor);

  const [shopName, setShopName] = useState('');
  const [rate, setRate] = useState(30);
  const [contact, setContact] = useState('');
  const [styleName, setStyleName] = useState('');
  const [colorName, setColorName] = useState('');
  const [error, setError] = useState('');

  const run = (fn: () => void) => {
    setError('');
    try {
      fn();
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>寄售小店</h3>
        <Table headers={['店名', '联系方式', '店家分成', '操作']}>
          {shops.map((sh) => (
            <tr key={sh.id}>
              <td style={tdStyle()}>{sh.name}</td>
              <td style={tdStyle()}>{sh.contact || '—'}</td>
              <td style={tdStyle()}>
                <input
                  type="number"
                  defaultValue={Math.round(sh.commissionRate * 100)}
                  style={{ ...inputStyle, width: 64 }}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)));
                    run(() => updateShop(sh.id, { commissionRate: v / 100 }));
                  }}
                />{' '}
                %
              </td>
              <td style={tdStyle()}>
                <button style={dangerBtn} onClick={() => run(() => deleteShop(sh.id))}>删除</button>
              </td>
            </tr>
          ))}
        </Table>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="店名">
            <input style={inputStyle} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="如：巷口毛线铺" />
          </Field>
          <Field label="店家分成（%）">
            <input type="number" style={inputStyle} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </Field>
          <Field label="联系方式（选填）">
            <input style={inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <button
            style={primaryBtn}
            onClick={() =>
              run(() => {
                if (!shopName.trim()) throw new ConsignmentError('请填写店名');
                addShop({ name: shopName.trim(), commissionRate: Math.max(0, Math.min(100, rate)) / 100, contact: contact.trim() || undefined });
                setShopName('');
                setContact('');
              })
            }
          >
            添加店铺
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>款式</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {styles.map((st) => (
            <span key={st.id} style={{ border: '1px solid #e0dcd5', borderRadius: 16, padding: '4px 10px', fontSize: 13, background: '#faf8f5' }}>
              {st.name}
              <button className="plain-link" style={{ marginLeft: 8, color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => run(() => deleteStyle(st.id))}>
                ×
              </button>
            </span>
          ))}
          {styles.length === 0 && <span style={{ color: '#999', fontSize: 13 }}>还没有款式</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <Field label="款式名称">
            <input style={inputStyle} value={styleName} onChange={(e) => setStyleName(e.target.value)} placeholder="如：贝雷帽" />
          </Field>
          <button style={ghostBtn} onClick={() => run(() => { if (!styleName.trim()) throw new ConsignmentError('请填写款式名'); addStyle(styleName.trim()); setStyleName(''); })}>
            添加款式
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>颜色</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {colors.map((co) => (
            <span key={co.id} style={{ border: '1px solid #e0dcd5', borderRadius: 16, padding: '4px 10px', fontSize: 13, background: '#faf8f5' }}>
              {co.name}
              <button style={{ marginLeft: 8, color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => run(() => deleteColor(co.id))}>
                ×
              </button>
            </span>
          ))}
          {colors.length === 0 && <span style={{ color: '#999', fontSize: 13 }}>还没有颜色</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <Field label="颜色名称">
            <input style={inputStyle} value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="如：燕麦色" />
          </Field>
          <button style={ghostBtn} onClick={() => run(() => { if (!colorName.trim()) throw new ConsignmentError('请填写颜色名'); addColor(colorName.trim()); setColorName(''); })}>
            添加颜色
          </button>
        </div>
      </section>
    </div>
  );
}
