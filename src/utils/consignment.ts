import type {
  ConsignmentState,
  Delivery,
  DeliveryLine,
  PriceAdjustment,
  ReturnVoucher,
  Sale,
  Settlement,
  SettlementLine,
} from '../types/consignment';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

// —— 锁账判定 ——

/** 该店是否已有某个已确认月份的对账单 */
export function confirmedMonths(state: ConsignmentState, shopId: string): Set<string> {
  return new Set(
    state.settlements.filter((s) => s.shopId === shopId && s.status === 'confirmed').map((s) => s.period),
  );
}

/** 日期所在月份是否已结账（已结账月份的单据不可增删改） */
export function isMonthLocked(state: ConsignmentState, shopId: string, date: string): boolean {
  return confirmedMonths(state, shopId).has(monthOf(date));
}

/** 该店是否已有任何更早的已确认月份（防止先结 3 月再补 2 月的账） */
export function isPeriodBlockedByFutureSettlement(state: ConsignmentState, shopId: string, period: string): boolean {
  return state.settlements.some((s) => s.shopId === shopId && s.status === 'confirmed' && s.period > period);
}

// —— 库存 ——

/** 手头库存键：styleId|colorId */
export function stockKey(styleId: string, colorId: string): string {
  return styleId + '|' + colorId;
}

/**
 * 手头可送库存 = 织好入库 + 退货回收 − 所有送货。
 * 退货单确认时自动生成 return-in 变动，所以退回来的件能重新送到另一家。
 */
export function onHandStock(state: ConsignmentState): Map<string, number> {
  const map = new Map<string, number>();
  const add = (k: string, q: number) => map.set(k, (map.get(k) ?? 0) + q);
  for (const m of state.movements) {
    if (m.type === 'produce' || m.type === 'return-in') add(stockKey(m.styleId, m.colorId), m.qty);
  }
  for (const d of state.deliveries) {
    for (const l of d.lines) add(stockKey(l.styleId, l.colorId), -l.qty);
  }
  return map;
}

/** 某家店当前在店库存（截至今天所有送货 − 售出 − 退回，按 SKU） */
export function shopCurrentStock(state: ConsignmentState, shopId: string): Map<string, number> {
  const map = new Map<string, number>();
  const add = (styleId: string, colorId: string, q: number) => {
    const k = stockKey(styleId, colorId);
    map.set(k, (map.get(k) ?? 0) + q);
  };
  for (const d of state.deliveries) {
    if (d.shopId !== shopId) continue;
    for (const l of d.lines) add(l.styleId, l.colorId, l.qty);
  }
  for (const s of state.sales) {
    if (s.shopId === shopId) add(s.styleId, s.colorId, -s.qty);
  }
  for (const r of state.returns) {
    if (r.shopId === shopId) add(r.styleId, r.colorId, -r.qty);
  }
  return map;
}

/** 校验一次送货总量不超过手头库存；返回超量的 SKU 描述 */
export function checkDeliveryAvailability(
  state: ConsignmentState,
  lines: DeliveryLine[],
  excludeDeliveryId?: string,
): { key: string; short: number }[] {
  const onHand = onHandStock(state);
  // 编辑已有送货单时，先把它自己占的量还回去
  if (excludeDeliveryId) {
    const old = state.deliveries.find((d) => d.id === excludeDeliveryId);
    if (old) for (const l of old.lines) onHand.set(stockKey(l.styleId, l.colorId), (onHand.get(stockKey(l.styleId, l.colorId)) ?? 0) + l.qty);
  }
  const shortage: { key: string; short: number }[] = [];
  for (const l of lines) {
    const have = onHand.get(stockKey(l.styleId, l.colorId)) ?? 0;
    if (l.qty > have) shortage.push({ key: stockKey(l.styleId, l.colorId), short: l.qty - have });
  }
  return shortage;
}

// —— 单据在某月范围内的归集 ——

function inPeriod(date: string, period: string): boolean {
  return monthOf(date) === period;
}

/** 期初：上月末在店数 = 该月之前全部送货 − 售出 − 退回 */
function openingFor(state: ConsignmentState, shopId: string, styleId: string, colorId: string, period: string): number {
  let n = 0;
  for (const d of state.deliveries) {
    if (d.shopId !== shopId || d.date >= period + '-01') continue;
    n += d.lines.filter((l) => l.styleId === styleId && l.colorId === colorId).reduce((a, l) => a + l.qty, 0);
  }
  for (const s of state.sales) {
    if (s.shopId === shopId && s.styleId === styleId && s.colorId === colorId && s.date < period + '-01') n -= s.qty;
  }
  for (const r of state.returns) {
    if (r.shopId === shopId && r.styleId === styleId && r.colorId === colorId && r.date < period + '-01') n -= r.qty;
  }
  return n;
}

/** 本月该店该 SKU 的约定售价：取本月内最近一次送货单价；本月没送货则取最近一张送货单 */
function agreedPrice(state: ConsignmentState, shopId: string, styleId: string, colorId: string, period: string): number {
  const prices: { date: string; price: number }[] = [];
  for (const d of state.deliveries) {
    if (d.shopId !== shopId) continue;
    for (const l of d.lines) {
      if (l.styleId === styleId && l.colorId === colorId) prices.push({ date: d.date, price: l.unitPrice });
    }
  }
  if (prices.length === 0) return 0;
  prices.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const inMonth = prices.find((p) => inPeriod(p.date, period));
  return (inMonth ?? prices[0]).price;
}

/**
 * 生成（或重算）某店某月的对账单草稿。
 * 同一个款式送过好几家店：按 shopId 分别调用，互不影响。
 */
export function buildSettlement(state: ConsignmentState, shopId: string, period: string): Settlement {
  const existing = state.settlements.find((s) => s.shopId === shopId && s.period === period);
  const reportMap = new Map<string, Partial<Record<'opening' | 'delivered' | 'sold' | 'returned' | 'ending', number | null>>>();
  if (existing) {
    for (const l of existing.lines) {
      reportMap.set(stockKey(l.styleId, l.colorId), {
        opening: l.reportOpening,
        delivered: l.reportDelivered,
        sold: l.reportSold,
        returned: l.reportReturned,
        ending: l.reportEnding,
      });
    }
  }

  // 出现在：期初有货 / 本月有送货 / 本月有售出 / 本月有退回 的所有 SKU
  const keys = new Set<string>();
  const consider = (styleId: string, colorId: string) => keys.add(stockKey(styleId, colorId));
  for (const d of state.deliveries) {
    if (d.shopId !== shopId) continue;
    // 历史送过的 SKU 都纳入候选（期初有压货、本月无动静也要对账），opening=0 的后面剔除
    for (const l of d.lines) consider(l.styleId, l.colorId);
  }
  for (const s of state.sales) if (s.shopId === shopId && inPeriod(s.date, period)) consider(s.styleId, s.colorId);
  for (const r of state.returns) if (r.shopId === shopId && inPeriod(r.date, period)) consider(r.styleId, r.colorId);

  const shop = state.shops.find((x) => x.id === shopId);
  const rate = shop?.commissionRate ?? 0;

  const lines: SettlementLine[] = [];
  const sortedKeys = [...keys].sort();
  for (const key of sortedKeys) {
    const [styleId, colorId] = key.split('|');
    const opening = openingFor(state, shopId, styleId, colorId, period);

    let delivered = 0;
    for (const d of state.deliveries) {
      if (d.shopId === shopId && inPeriod(d.date, period)) {
        delivered += d.lines.filter((l) => l.styleId === styleId && l.colorId === colorId).reduce((a, l) => a + l.qty, 0);
      }
    }
    let sold = 0;
    let soldAmount = 0;
    for (const s of state.sales) {
      if (s.shopId === shopId && s.styleId === styleId && s.colorId === colorId && inPeriod(s.date, period)) {
        sold += s.qty;
        soldAmount += s.qty * s.unitPrice;
      }
    }
    let returned = 0;
    for (const r of state.returns) {
      if (r.shopId === shopId && r.styleId === styleId && r.colorId === colorId && inPeriod(r.date, period)) returned += r.qty;
    }
    const ending = opening + delivered - sold - returned;
    // 本月完全没有业务、期初也没压货的 SKU 不进对账单
    if (opening === 0 && delivered === 0 && sold === 0 && returned === 0) continue;
    const unitPrice = agreedPrice(state, shopId, styleId, colorId, period);
    const shopShare = money(soldAmount * rate);
    const maker = money(soldAmount - shopShare);

    const rep = reportMap.get(key);
    const line: SettlementLine = {
      styleId,
      colorId,
      opening,
      delivered,
      sold,
      returned,
      ending,
      reportOpening: rep?.opening ?? null,
      reportDelivered: rep?.delivered ?? null,
      reportSold: rep?.sold ?? null,
      reportReturned: rep?.returned ?? null,
      reportEnding: rep?.ending ?? null,
      agreedUnitPrice: unitPrice,
      soldAmount: money(soldAmount),
      shopShare,
      makerAmount: maker,
      diffs: [],
    };
    line.diffs = diffsForLine(line);
    lines.push(line);
  }

  return {
    id: existing?.id ?? uid('st_'),
    shopId,
    period,
    status: existing?.status ?? 'draft',
    lines,
    confirmedAt: existing?.confirmedAt,
    note: existing?.note,
  };
}

/** 逐行核对：把对不上的项列出来并写清差在哪 */
export function diffsForLine(l: SettlementLine): string[] {
  const diffs: string[] = [];
  type Item = { label: string; mine: number; theirs: number | null };
  const items: Item[] = [
    { label: '月初余货', mine: l.opening, theirs: l.reportOpening },
    { label: '本月送出', mine: l.delivered, theirs: l.reportDelivered },
    { label: '本月卖出', mine: l.sold, theirs: l.reportSold },
    { label: '本月退回', mine: l.returned, theirs: l.reportReturned },
    { label: '月末在店', mine: l.ending, theirs: l.reportEnding },
  ];
  for (const it of items) {
    if (it.theirs === null) continue; // 对方没报这一项不算差异
    const gap = it.theirs - it.mine;
    if (gap !== 0) {
      diffs.push(`${it.label}差 ${Math.abs(gap)} 件（我方账面 ${it.mine}，对方报 ${it.theirs}，${gap > 0 ? '对方多报' : '对方少报'}）`);
    }
  }
  // 对方数自身钩稽不平也提示：期初+送出-卖出-退回 应等于期末
  const rep = [l.reportOpening, l.reportDelivered, l.reportSold, l.reportReturned];
  if (rep.every((v) => v !== null) && l.reportEnding !== null) {
    const expect = (l.reportOpening ?? 0) + (l.reportDelivered ?? 0) - (l.reportSold ?? 0) - (l.reportReturned ?? 0);
    if (expect !== l.reportEnding) {
      diffs.push(`对方报数本身对不平：期初+送出-卖出-退回=${expect}，但报期末=${l.reportEnding}`);
    }
  }
  return diffs;
}

export function settlementTotals(lines: SettlementLine[]): {
  soldQty: number;
  soldAmount: number;
  shopShare: number;
  makerAmount: number;
  diffCount: number;
} {
  return {
    soldQty: lines.reduce((a, l) => a + l.sold, 0),
    soldAmount: money(lines.reduce((a, l) => a + l.soldAmount, 0)),
    shopShare: money(lines.reduce((a, l) => a + l.shopShare, 0)),
    makerAmount: money(lines.reduce((a, l) => a + l.makerAmount, 0)),
    diffCount: lines.reduce((a, l) => a + l.diffs.length, 0),
  };
}

// —— 单据归属月份的锁账辅助 ——

export function deliveryMonth(d: Delivery): string {
  return monthOf(d.date);
}
export function saleMonth(s: Sale): string {
  return monthOf(s.date);
}
export function returnMonth(r: ReturnVoucher): string {
  return monthOf(r.date);
}
export function adjustmentMonth(a: PriceAdjustment): string {
  return monthOf(a.date);
}
