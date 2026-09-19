import { useMemo, useState } from 'react';
import { ConsignmentError, useConsignmentStore } from '../../store/consignmentStore';
import type { SettlementLine } from '../../types/consignment';
import {
  buildSettlement,
  isMonthLocked,
  isPeriodBlockedByFutureSettlement,
  settlementTotals,
  stockKey,
} from '../../utils/consignment';
import { Field, Notice, Table } from './ui';
import { cardStyle, ghostBtn, inputStyle, primaryBtn, tdStyle } from './uiStyles';
import { useConsignNames } from './useConsignNames';

type Slot = 'reportOpening' | 'reportDelivered' | 'reportSold' | 'reportReturned' | 'reportEnding';

function defaultPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1); // 默认对上个月
  return d.toISOString().slice(0, 7);
}

export default function ReconcileTab() {
  const state = useConsignmentStore();
  const { shops, shopName, styleName, colorName } = useConsignNames();
  const saveReport = useConsignmentStore((s) => s.saveReport);
  const confirmSettlement = useConsignmentStore((s) => s.confirmSettlement);

  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [period, setPeriod] = useState(defaultPeriod());
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // 对方报数的本地编辑值：key=skuKey，值字符串（空串=未报）
  const [draftReport, setDraftReport] = useState<Record<string, Partial<Record<Slot, string>>>>({});

  const locked = shopId ? isMonthLocked(state, shopId, period + '-01') : false;
  const saved = shopId ? state.settlements.find((s) => s.shopId === shopId && s.period === period) : undefined;
  const blockedByFuture = shopId ? isPeriodBlockedByFutureSettlement(state, shopId, period) : false;

  // 账面数据：草稿始终按当前单据实时重算（已录入的对方报数由 buildSettlement 带回）；
  // 已结账月份使用存档快照，结账后永不再变
  const settlement = useMemo(() => {
    if (!shopId) return null;
    if (saved?.status === 'confirmed') return saved;
    return buildSettlement(state, shopId, period);
  }, [state, shopId, period, saved]);

  const getRepValue = (line: SettlementLine, slot: Slot): string => {
    const k = stockKey(line.styleId, line.colorId);
    if (k in draftReport && slot in (draftReport[k] ?? {})) return draftReport[k][slot] ?? '';
    const v = line[slot];
    return v === null ? '' : String(v);
  };

  const setRepValue = (line: SettlementLine, slot: Slot, raw: string) => {
    const k = stockKey(line.styleId, line.colorId);
    setDraftReport((m) => ({ ...m, [k]: { ...(m[k] ?? {}), [slot]: raw } }));
  };

  const persistReport = () => {
    setError('');
    setOk('');
    try {
      const report: Record<string, Partial<Record<Slot, number | null>>> = {};
      for (const [k, slots] of Object.entries(draftReport)) {
        const row: Partial<Record<Slot, number | null>> = {};
        for (const [slot, raw] of Object.entries(slots)) {
          row[slot as Slot] = raw === '' || raw === undefined ? null : Number(raw);
        }
        report[k] = row;
      }
      saveReport(shopId, period, report);
      setDraftReport({});
      setOk('对方报数已保存，差异已更新');
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  const doConfirm = () => {
    setError('');
    setOk('');
    try {
      // 先保存一次当前编辑的报数
      const report: Record<string, Partial<Record<Slot, number | null>>> = {};
      for (const [k, slots] of Object.entries(draftReport)) {
        const row: Partial<Record<Slot, number | null>> = {};
        for (const [slot, raw] of Object.entries(slots)) row[slot as Slot] = raw === '' || raw === undefined ? null : Number(raw);
        report[k] = row;
      }
      if (Object.keys(report).length > 0) saveReport(shopId, period, report);
      if (!confirm('结账后本月所有送货/售出/退货记录将锁定，不能再改。确定结账吗？')) return;
      confirmSettlement(shopId, period);
      setDraftReport({});
      setOk(`${shopName(shopId)} ${period} 对账已结账`);
    } catch (e) {
      setError(e instanceof ConsignmentError ? e.message : String(e));
    }
  };

  if (shops.length === 0) {
    return <Notice kind="info">先到「基础资料」添加小店，再来月结。</Notice>;
  }

  const totals = settlement ? settlementTotals(settlement.lines) : null;
  const rate = shops.find((x) => x.id === shopId)?.commissionRate ?? 0;

  return (
    <div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      <section style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="选择小店">
            <select style={inputStyle} value={shopId} onChange={(e) => { setShopId(e.target.value); setDraftReport({}); setError(''); }}>
              {shops.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
            </select>
          </Field>
          <Field label="对账月份">
            <input type="month" style={inputStyle} value={period} onChange={(e) => { setPeriod(e.target.value); setDraftReport({}); }} />
          </Field>
          {locked ? (
            <span style={{ color: '#8c6f4e', fontWeight: 600, fontSize: 14 }}>🔒 该月已结账（{saved?.confirmedAt?.slice(0, 10)} 确认），记录已锁定</span>
          ) : blockedByFuture ? (
            <span style={{ color: '#a94442', fontSize: 13 }}>已有更晚月份结账，需先按顺序核对本月</span>
          ) : (
            <span style={{ color: '#999', fontSize: 13 }}>草稿状态，可随时修改单据</span>
          )}
        </div>
      </section>

      {settlement && totals && (
        <>
          <section style={cardStyle}>
            <h3 style={{ margin: '0 0 4px' }}>数量核对：我方账面 vs 对方报数</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
              把店家报来的数填进白色输入框（没报的项留空）；期初+送出−卖出−退回 应当等于期末。
            </p>
            <div style={{ overflowX: 'auto' }}>
              <Table
                headers={[
                  '款式 / 颜色',
                  '账面期初',
                  '对方报期初',
                  '账面送出',
                  '对方报送出',
                  '账面卖出',
                  '对方报卖出',
                  '账面退回',
                  '对方报退回',
                  '账面期末',
                  '对方报期末',
                  '差异',
                ]}
              >
                {settlement.lines.map((l) => {
                  const k = stockKey(l.styleId, l.colorId);
                  return (
                    <tr key={k}>
                      <td style={tdStyle()}>{styleName(l.styleId)} / {colorName(l.colorId)}</td>
                      <td style={tdStyle()}>{l.opening}</td>
                      <td style={tdStyle()}><RepInput disabled={locked} value={getRepValue(l, 'reportOpening')} onChange={(v) => setRepValue(l, 'reportOpening', v)} mine={l.opening} /></td>
                      <td style={tdStyle()}>{l.delivered}</td>
                      <td style={tdStyle()}><RepInput disabled={locked} value={getRepValue(l, 'reportDelivered')} onChange={(v) => setRepValue(l, 'reportDelivered', v)} mine={l.delivered} /></td>
                      <td style={tdStyle()}>{l.sold}</td>
                      <td style={tdStyle()}><RepInput disabled={locked} value={getRepValue(l, 'reportSold')} onChange={(v) => setRepValue(l, 'reportSold', v)} mine={l.sold} /></td>
                      <td style={tdStyle()}>{l.returned}</td>
                      <td style={tdStyle()}><RepInput disabled={locked} value={getRepValue(l, 'reportReturned')} onChange={(v) => setRepValue(l, 'reportReturned', v)} mine={l.returned} /></td>
                      <td style={{ ...tdStyle(), fontWeight: 600 }}>{l.ending}</td>
                      <td style={tdStyle()}><RepInput disabled={locked} value={getRepValue(l, 'reportEnding')} onChange={(v) => setRepValue(l, 'reportEnding', v)} mine={l.ending} /></td>
                      <td style={tdStyle()}>
                        {l.diffs.length === 0 ? (
                          <span style={{ color: '#3c763d', fontSize: 12 }}>{hasAnyReport(l) ? '✓ 一致' : '—'}</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 16, color: '#a94442', fontSize: 12 }}>
                            {l.diffs.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </div>
            {settlement.lines.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>本月这家店没有任何业务记录。</p>}

            {!locked && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button style={primaryBtn} onClick={persistReport}>保存对方报数</button>
                <button style={ghostBtn} onClick={() => setDraftReport({})}>清空未保存的填写</button>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={{ margin: '0 0 12px' }}>金额与分成</h3>
            <Table headers={['款式 / 颜色', '卖出件数', '约定单价', '销售额（按实际成交价）', `店家分成 ${Math.round(rate * 100)}%`, '我方应得']}>
              {settlement.lines.filter((l) => l.sold > 0 || l.soldAmount > 0).map((l) => (
                <tr key={stockKey(l.styleId, l.colorId)}>
                  <td style={tdStyle()}>{styleName(l.styleId)} / {colorName(l.colorId)}</td>
                  <td style={tdStyle()}>{l.sold}</td>
                  <td style={tdStyle()}>{l.agreedUnitPrice.toFixed(2)}</td>
                  <td style={tdStyle()}>{l.soldAmount.toFixed(2)}</td>
                  <td style={tdStyle()}>{l.shopShare.toFixed(2)}</td>
                  <td style={{ ...tdStyle(), fontWeight: 600 }}>{l.makerAmount.toFixed(2)}</td>
                </tr>
              ))}
            </Table>
            <div style={{ marginTop: 12, display: 'flex', gap: 24, fontSize: 14, flexWrap: 'wrap' }}>
              <span>卖出合计：<b>{totals.soldQty}</b> 件</span>
              <span>销售总额：<b>{totals.soldAmount.toFixed(2)}</b> 元</span>
              <span>店家分成合计：<b>{totals.shopShare.toFixed(2)}</b> 元</span>
              <span>我方应得：<b style={{ color: '#8c6f4e' }}>{totals.makerAmount.toFixed(2)}</b> 元</span>
              <span>待处理差异：<b style={{ color: totals.diffCount > 0 ? '#a94442' : '#3c763d' }}>{totals.diffCount}</b> 处</span>
            </div>
            {totals.diffCount > 0 && !locked && (
              <Notice kind="info">还有对不上的数目，建议先联系店家核实，再结账；也可以先结账留痕，差异记录会一并锁定。</Notice>
            )}
            {!locked && (
              <div style={{ marginTop: 12 }}>
                <button style={{ ...primaryBtn, background: '#3c763d', borderColor: '#3c763d' }} onClick={doConfirm}>
                  确认结账（锁定 {period} 全部记录）
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>历史对账单</h3>
        <Table headers={['月份', '店铺', '状态', '确认时间', '卖出件数', '我方应得', '差异数']}>
          {[...state.settlements]
            .filter((s) => !shopId || s.shopId === shopId)
            .sort((a, b) => (a.period < b.period ? 1 : -1))
            .map((s) => {
              const t = settlementTotals(s.lines);
              return (
                <tr key={s.id}>
                  <td style={tdStyle()}>
                    <button
                      style={{ border: 'none', background: 'none', color: '#31709e', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      onClick={() => { setShopId(s.shopId); setPeriod(s.period); setDraftReport({}); }}
                    >
                      {s.period}
                    </button>
                  </td>
                  <td style={tdStyle()}>{shopName(s.shopId)}</td>
                  <td style={tdStyle()}>{s.status === 'confirmed' ? '🔒 已结账' : '草稿'}</td>
                  <td style={tdStyle()}>{s.confirmedAt?.slice(0, 10) ?? '—'}</td>
                  <td style={tdStyle()}>{t.soldQty}</td>
                  <td style={tdStyle()}>{t.makerAmount.toFixed(2)}</td>
                  <td style={{ ...tdStyle(), color: t.diffCount > 0 ? '#a94442' : '#3c763d' }}>{t.diffCount}</td>
                </tr>
              );
            })}
        </Table>
      </section>
    </div>
  );
}

function hasAnyReport(l: SettlementLine): boolean {
  return [l.reportOpening, l.reportDelivered, l.reportSold, l.reportReturned, l.reportEnding].some((v) => v !== null);
}

function RepInput({ disabled, value, onChange, mine }: { disabled: boolean; value: string; onChange: (v: string) => void; mine: number }) {
  const num = value === '' ? null : Number(value);
  const mismatch = num !== null && num !== mine;
  return (
    <input
      type="number"
      disabled={disabled}
      style={{ width: 64, padding: '4px 6px', border: `1px solid ${mismatch ? '#e0a0a0' : '#cfc9bf'}`, borderRadius: 4, background: mismatch ? '#fdecea' : '#fff' }}
      value={value}
      placeholder="未报"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
