import type {
  ConsignmentData,
  Delivery,
  Discrepancy,
  ReturnRecord,
  Settlement,
  SettlementLine,
} from '../types/consignment';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function today(): string {
  const d = new Date();
  return toDayKey(d);
}

export function currentPeriod(): string {
  return today().slice(0, 7);
}

export function toDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 该期间最后一天 */
export function periodEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${period}-${String(last).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: number): string {
  return `¥${round2(n).toFixed(2)}`;
}

export function shareLabel(ourShare: number): string {
  return `${Math.round(ourShare * 100)} : ${Math.round((1 - ourShare) * 100)}`;
}

export function findShop(data: ConsignmentData, shopId: string) {
  return data.shops.find((s) => s.id === shopId);
}

export function findProduct(data: ConsignmentData, productId: string) {
  return data.products.find((p) => p.id === productId);
}

export function productLabel(p: { style: string; color: string } | undefined): string {
  if (!p) return '（已删除款式）';
  return `${p.style} · ${p.color}`;
}

export function isDeliveryLocked(d: Delivery): boolean {
  return !!d.settlementId;
}

export function isReturnLocked(r: ReturnRecord): boolean {
  return !!r.settlementId;
}

export function findSettlement(data: ConsignmentData, id?: string): Settlement | undefined {
  if (!id) return undefined;
  return data.settlements.find((s) => s.id === id);
}

/** 该店、该款、截至某日（含）已送过多少件（含被账单占用的） */
export function deliveredUpTo(
  data: ConsignmentData,
  shopId: string,
  productId: string,
  upToDate?: string
): number {
  return data.deliveries
    .filter((d) => d.shopId === shopId && (!upToDate || d.date <= upToDate))
    .reduce((sum, d) => sum + (d.lines.find((l) => l.productId === productId)?.qty ?? 0), 0);
}

/** 该店、该款、截至某日实际已退回多少件 */
export function returnedUpTo(
  data: ConsignmentData,
  shopId: string,
  productId: string,
  upToDate?: string
): number {
  return data.returns
    .filter((r) => r.shopId === shopId && (!upToDate || r.date <= upToDate))
    .reduce((sum, r) => sum + (r.lines.find((l) => l.productId === productId)?.qty ?? 0), 0);
}

/** 某店最近一张已确认对账单（按期数） */
export function latestConfirmed(data: ConsignmentData, shopId: string): Settlement | undefined {
  return data.settlements
    .filter((s) => s.shopId === shopId && s.status === 'confirmed')
    .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
}

/** 已确认账单的期末店存（快照值） */
export function confirmedClosing(
  data: ConsignmentData,
  shopId: string,
  productId: string
): number {
  const s = latestConfirmed(data, shopId);
  if (!s) return 0;
  return s.lines.find((l) => l.productId === productId)?.bookClosing ?? 0;
}

/** 已确认账单的截止日期 */
export function confirmedThroughDate(data: ConsignmentData, shopId: string): string | undefined {
  const s = latestConfirmed(data, shopId);
  return s ? periodEnd(s.period) : undefined;
}

/**
 * 店里现在还剩多少件（实物口径：送 − 已退回 − 已结账卖掉）。
 * 已结账期之后的新送货/退货按单据逐笔加/减。
 */
export function onShopFloor(
  data: ConsignmentData,
  shopId: string,
  productId: string
): number {
  const through = confirmedThroughDate(data, shopId);
  const afterDelivered = data.deliveries
    .filter((d) => d.shopId === shopId && (!through || d.date > through))
    .reduce((sum, d) => sum + (d.lines.find((l) => l.productId === productId)?.qty ?? 0), 0);
  const afterReturned = data.returns
    .filter((r) => r.shopId === shopId && (!through || r.date > through))
    .reduce((sum, r) => sum + (r.lines.find((l) => l.productId === productId)?.qty ?? 0), 0);
  return confirmedClosing(data, shopId, productId) + afterDelivered - afterReturned;
}

/** 自己手上可再配送的库存：总入库 − 所有在店件数（未结的退货单等，含在店口径内） */
export function availableStock(data: ConsignmentData, productId: string): number {
  const inbound = data.stockIns
    .filter((s) => s.productId === productId)
    .reduce((sum, s) => sum + s.qty, 0);
  const inShops = data.shops.reduce(
    (sum, shop) => sum + onShopFloor(data, shop.id, productId),
    0
  );
  return inbound - inShops;
}

/** 某款的总库存（含各店在卖的） */
export function totalStock(data: ConsignmentData, productId: string): number {
  return data.stockIns
    .filter((s) => s.productId === productId)
    .reduce((sum, s) => sum + s.qty, 0);
}

/** 被账单（草稿或已确认）占用的送货/退货单 */
export function settlementForMovement(
  data: ConsignmentData,
  settlementId?: string
): Settlement | undefined {
  return findSettlement(data, settlementId);
}

export type PendingMovement = {
  delivery?: Delivery;
  return?: ReturnRecord;
};

/**
 * 该店截至某期末、尚未被任何对账单占用的送货单/退货单。
 * 注意：按规则新期间必须晚于最近一次已确认期间。
 */
export function pendingMovements(
  data: ConsignmentData,
  shopId: string,
  endDate: string
): { deliveries: Delivery[]; returns: ReturnRecord[] } {
  return {
    deliveries: data.deliveries.filter(
      (d) => d.shopId === shopId && !d.settlementId && d.date <= endDate
    ),
    returns: data.returns.filter(
      (r) => r.shopId === shopId && !r.settlementId && r.date <= endDate
    ),
  };
}

export type LineInputs = {
  productId: string;
  opening: number;
  delivered: number;
  returned: number;
  reportSold: number;
  reportReturned: number;
  reportClosing: number;
  price: number;
  ourShare: number;
};

/** 计算一行对账结果（我方账算店存、金额、差异） */
export function buildSettlementLine(input: LineInputs): SettlementLine {
  const bookClosing = input.opening + input.delivered - input.returned - input.reportSold;
  const discrepancies: Discrepancy[] = [];

  // 差异 1：流水恒等式——对方三项报数对不上（差 reportSold+reportReturned+reportClosing vs 期初+送−退）
  const flowExpected = input.opening + input.delivered - input.returned;
  const flowReported = input.reportSold + input.reportReturned + input.reportClosing;
  if (flowExpected !== flowReported) {
    const diff = flowReported - flowExpected;
    discrepancies.push({
      productId: input.productId,
      kind: 'flow',
      expected: flowExpected,
      reported: flowReported,
      diff,
      message:
        `报数不平：对方报卖出 ${input.reportSold} + 退货 ${input.reportReturned} + 店存 ${input.reportClosing}` +
        ` = ${flowReported} 件，我方账上（期初 ${input.opening} + 送 ${input.delivered} − 退 ${input.returned}）应为 ${flowExpected} 件，` +
        `${diff > 0 ? `多报 ${diff}` : `少报 ${-diff}`} 件。`,
    });
  }

  // 差异 2：退货件数——对方报的退货数与我方实际收到的不一致
  if (input.reportReturned !== input.returned) {
    const diff = input.reportReturned - input.returned;
    discrepancies.push({
      productId: input.productId,
      kind: 'returns',
      expected: input.returned,
      reported: input.reportReturned,
      diff,
      message:
        `退货对不上：对方报退 ${input.reportReturned} 件，我方实际收到 ${input.returned} 件，` +
        `${diff > 0 ? `对方多报 ${diff} 件（可能在途未到）` : `少退 ${-diff} 件（需追查）`}。`,
    });
  }

  const ourAmount = round2(input.reportSold * input.price * input.ourShare);
  const shopAmount = round2(input.reportSold * input.price - ourAmount);

  return {
    productId: input.productId,
    opening: input.opening,
    delivered: input.delivered,
    returned: input.returned,
    reportSold: input.reportSold,
    reportReturned: input.reportReturned,
    reportClosing: input.reportClosing,
    bookClosing,
    price: input.price,
    ourShare: input.ourShare,
    ourAmount,
    shopAmount,
    discrepancies,
  };
}

/** 一张对账单的合计 */
export function settlementTotals(lines: SettlementLine[]) {
  return {
    sold: lines.reduce((s, l) => s + l.reportSold, 0),
    returned: lines.reduce((s, l) => s + l.returned, 0),
    gross: round2(lines.reduce((s, l) => s + l.reportSold * l.price, 0)),
    ourAmount: round2(lines.reduce((s, l) => s + l.ourAmount, 0)),
    shopAmount: round2(lines.reduce((s, l) => s + l.shopAmount, 0)),
    discrepancyCount: lines.reduce((s, l) => s + l.discrepancies.length, 0),
  };
}
