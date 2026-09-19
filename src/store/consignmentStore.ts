import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ColorDef,
  ConsignmentState,
  Delivery,
  DeliveryLine,
  PriceAdjustment,
  ReturnVoucher,
  Sale,
  Settlement,
  SettlementLine,
  Shop,
  StockMovement,
  Style,
} from '../types/consignment';
import {
  buildSettlement,
  checkDeliveryAvailability,
  diffsForLine,
  isMonthLocked,
  isPeriodBlockedByFutureSettlement,
  monthOf,
  stockKey,
  today,
  uid,
} from '../utils/consignment';

const EMPTY: ConsignmentState = {
  shops: [],
  styles: [],
  colors: [],
  movements: [],
  deliveries: [],
  sales: [],
  returns: [],
  adjustments: [],
  settlements: [],
};

/** 业务规则被违反时抛出，UI 直接提示 */
export class ConsignmentError extends Error {}

function requireUnlocked(state: ConsignmentState, shopId: string, date: string, what: string) {
  if (isMonthLocked(state, shopId, date)) {
    throw new ConsignmentError(`${what}：${monthOf(date)} 已结账，结过账的批次不允许再改动`);
  }
}

/** 价格变动行：新单价 ≠ 旧单价 时必须给说明 */
function priceChanges(
  oldLines: DeliveryLine[],
  newLines: DeliveryLine[],
): { line: DeliveryLine; oldPrice: number }[] {
  const out: { line: DeliveryLine; oldPrice: number }[] = [];
  for (const n of newLines) {
    const o = oldLines.find((l) => l.styleId === n.styleId && l.colorId === n.colorId);
    if (o && o.unitPrice !== n.unitPrice) out.push({ line: n, oldPrice: o.unitPrice });
  }
  return out;
}

interface ConsignmentActions {
  // 基础资料
  addShop: (data: Omit<Shop, 'id' | 'createdAt'>) => string;
  updateShop: (id: string, patch: Partial<Omit<Shop, 'id' | 'createdAt'>>) => void;
  deleteShop: (id: string) => void;
  addStyle: (name: string) => string;
  deleteStyle: (id: string) => void;
  addColor: (name: string) => string;
  deleteColor: (id: string) => void;

  // 库存与单据
  addProduce: (data: { date: string; styleId: string; colorId: string; qty: number; note?: string }) => void;
  addDelivery: (data: { shopId: string; date: string; lines: DeliveryLine[]; note?: string }) => string;
  updateDelivery: (id: string, data: { date: string; lines: DeliveryLine[]; note?: string }, priceReason?: string) => void;
  deleteDelivery: (id: string) => void;
  addSale: (data: Omit<Sale, 'id'>, priceReason?: string) => string;
  deleteSale: (id: string) => void;
  addReturn: (data: Omit<ReturnVoucher, 'id'>) => string;
  deleteReturn: (id: string) => void;

  // 对账
  /** 保存店家报来的数（写入草稿对账单） */
  saveReport: (shopId: string, period: string, report: Record<string, Partial<Record<keyof ReportSlots, number | null>>>) => void;
  getDraftSettlement: (shopId: string, period: string) => Settlement;
  confirmSettlement: (shopId: string, period: string, note?: string) => void;
}

type ReportSlots = Pick<SettlementLine, 'reportOpening' | 'reportDelivered' | 'reportSold' | 'reportReturned' | 'reportEnding'>;
const REPORT_SLOT_KEYS: (keyof ReportSlots)[] = [
  'reportOpening',
  'reportDelivered',
  'reportSold',
  'reportReturned',
  'reportEnding',
];

export const useConsignmentStore = create<ConsignmentState & ConsignmentActions>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      addShop: (data) => {
        const shop: Shop = { id: uid('sh_'), createdAt: new Date().toISOString(), ...data };
        set((s) => ({ shops: [...s.shops, shop] }));
        return shop.id;
      },

      updateShop: (id, patch) =>
        set((s) => ({ shops: s.shops.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      deleteShop: (id) => {
        const state = get();
        if (state.deliveries.some((d) => d.shopId === id) || state.sales.some((x) => x.shopId === id) || state.returns.some((x) => x.shopId === id)) {
          throw new ConsignmentError('该店已有送货/售出/退货记录，不能删除（可改名停用）');
        }
        set((s) => ({ shops: s.shops.filter((x) => x.id !== id) }));
      },

      addStyle: (name) => {
        const style: Style = { id: uid('st_'), name };
        set((s) => ({ styles: [...s.styles, style] }));
        return style.id;
      },
      deleteStyle: (id) => {
        const state = get();
        const used =
          state.movements.some((m) => m.styleId === id) ||
          state.deliveries.some((d) => d.lines.some((l) => l.styleId === id)) ||
          state.sales.some((x) => x.styleId === id) ||
          state.returns.some((x) => x.styleId === id);
        if (used) throw new ConsignmentError('该款式已有业务记录，不能删除');
        set((s) => ({ styles: s.styles.filter((x) => x.id !== id) }));
      },

      addColor: (name) => {
        const color: ColorDef = { id: uid('co_'), name };
        set((s) => ({ colors: [...s.colors, color] }));
        return color.id;
      },
      deleteColor: (id) => {
        const state = get();
        const used =
          state.movements.some((m) => m.colorId === id) ||
          state.deliveries.some((d) => d.lines.some((l) => l.colorId === id)) ||
          state.sales.some((x) => x.colorId === id) ||
          state.returns.some((x) => x.colorId === id);
        if (used) throw new ConsignmentError('该颜色已有业务记录，不能删除');
        set((s) => ({ colors: s.colors.filter((x) => x.id !== id) }));
      },

      addProduce: ({ date, styleId, colorId, qty, note }) => {
        if (qty <= 0) throw new ConsignmentError('入库件数必须大于 0');
        const mv: StockMovement = { id: uid('mv_'), date, styleId, colorId, qty, type: 'produce', note };
        set((s) => ({ movements: [...s.movements, mv] }));
      },

      addDelivery: ({ shopId, date, lines, note }) => {
        const state = get();
        requireUnlocked(state, shopId, date, '新增送货单');
        const valid = lines.filter((l) => l.qty > 0);
        if (valid.length === 0) throw new ConsignmentError('请至少填写一行有效明细');
        if (valid.some((l) => l.unitPrice < 0)) throw new ConsignmentError('售价不能为负');
        const shortage = checkDeliveryAvailability(state, valid);
        if (shortage.length > 0) {
          throw new ConsignmentError(`手头库存不足：${shortage.map((x) => x.key).join('、')}，请先登记织好入库或等退货回收`);
        }
        const delivery: Delivery = { id: uid('dl_'), shopId, date, lines: valid, note };
        set((s) => ({ deliveries: [...s.deliveries, delivery] }));
        return delivery.id;
      },

      updateDelivery: (id, { date, lines, note }, priceReason) => {
        const state = get();
        const old = state.deliveries.find((d) => d.id === id);
        if (!old) throw new ConsignmentError('送货单不存在');
        requireUnlocked(state, old.shopId, old.date, '修改送货单');
        if (date !== old.date) requireUnlocked(state, old.shopId, date, '修改送货单日期');
        const valid = lines.filter((l) => l.qty > 0);
        if (valid.length === 0) throw new ConsignmentError('请至少填写一行有效明细');
        const shortage = checkDeliveryAvailability(state, valid, id);
        if (shortage.length > 0) {
          throw new ConsignmentError(`手头库存不足：${shortage.map((x) => x.key).join('、')}`);
        }
        // 改价必须走一次说明
        const changes = priceChanges(old.lines, valid);
        if (changes.length > 0 && !(priceReason && priceReason.trim())) {
          throw new ConsignmentError('有明细单价发生变化，必须填写改价说明');
        }
        const newAdjustments: PriceAdjustment[] = changes.map(({ line, oldPrice }) => ({
          id: uid('pa_'),
          shopId: old.shopId,
          date: today(),
          styleId: line.styleId,
          colorId: line.colorId,
          kind: 'delivery',
          oldPrice,
          newPrice: line.unitPrice,
          reason: priceReason!.trim(),
          refId: id,
          createdAt: new Date().toISOString(),
        }));
        set((s) => ({
          deliveries: s.deliveries.map((d) => (d.id === id ? { ...d, date, lines: valid, note } : d)),
          adjustments: [...s.adjustments, ...newAdjustments],
        }));
      },

      deleteDelivery: (id) => {
        const state = get();
        const old = state.deliveries.find((d) => d.id === id);
        if (!old) return;
        requireUnlocked(state, old.shopId, old.date, '删除送货单');
        // 已有后续售出/退货引用时不允许直接删
        const touched = new Set(old.lines.map((l) => stockKey(l.styleId, l.colorId)));
        const linked =
          state.sales.some((x) => x.shopId === old.shopId && touched.has(stockKey(x.styleId, x.colorId))) ||
          state.returns.some((x) => x.shopId === old.shopId && touched.has(stockKey(x.styleId, x.colorId)));
        if (linked) throw new ConsignmentError('这张送货单的货已有售出或退货记录，不能删除');
        set((s) => ({
          deliveries: s.deliveries.filter((d) => d.id !== id),
          adjustments: s.adjustments.filter((a) => !(a.kind === 'delivery' && a.refId === id)),
        }));
      },

      addSale: (data, priceReason) => {
        const state = get();
        if (data.qty <= 0) throw new ConsignmentError('售出件数必须大于 0');
        requireUnlocked(state, data.shopId, data.date, '登记售出');
        // 不能超过在店库存
        const shopStock = shopStockAt(state, data.shopId);
        const cur = shopStock.get(stockKey(data.styleId, data.colorId)) ?? 0;
        if (data.qty > cur) throw new ConsignmentError(`在店库存只有 ${cur} 件，不能登记售出 ${data.qty} 件`);
        // 实际成交价与约定价（最近送货价）不同，必须附说明
        const agreed = latestDeliveryPrice(state, data.shopId, data.styleId, data.colorId);
        let newAdjustment: PriceAdjustment | null = null;
        if (agreed !== null && data.unitPrice !== agreed) {
          if (!(priceReason && priceReason.trim())) {
            throw new ConsignmentError(`实际售价 ${data.unitPrice} 与约定价 ${agreed} 不一致，必须填写改价说明`);
          }
          newAdjustment = {
            id: uid('pa_'),
            shopId: data.shopId,
            date: data.date,
            styleId: data.styleId,
            colorId: data.colorId,
            kind: 'sale',
            oldPrice: agreed,
            newPrice: data.unitPrice,
            reason: priceReason.trim(),
            refId: '', // 售出记录保存后回填
            createdAt: new Date().toISOString(),
          };
        }
        const sale: Sale = { id: uid('sa_'), ...data };
        if (newAdjustment) newAdjustment.refId = sale.id;
        set((s) => ({
          sales: [...s.sales, sale],
          adjustments: newAdjustment ? [...s.adjustments, newAdjustment] : s.adjustments,
        }));
        return sale.id;
      },

      deleteSale: (id) => {
        const state = get();
        const old = state.sales.find((x) => x.id === id);
        if (!old) return;
        requireUnlocked(state, old.shopId, old.date, '删除售出记录');
        set((s) => ({
          sales: s.sales.filter((x) => x.id !== id),
          adjustments: s.adjustments.filter((a) => !(a.kind === 'sale' && a.refId === id)),
        }));
      },

      addReturn: (data) => {
        const state = get();
        if (data.qty <= 0) throw new ConsignmentError('退货件数必须大于 0');
        requireUnlocked(state, data.shopId, data.date, '登记退货');
        const cur = shopStockAt(state, data.shopId).get(stockKey(data.styleId, data.colorId)) ?? 0;
        if (data.qty > cur) throw new ConsignmentError(`在店库存只有 ${cur} 件，不能退回 ${data.qty} 件`);
        const ret: ReturnVoucher = { id: uid('rt_'), ...data };
        // 退回来的件自动回库（return-in），之后可以重新送到另一家
        const inbound: StockMovement = {
          id: uid('mv_'),
          date: data.date,
          styleId: data.styleId,
          colorId: data.colorId,
          qty: data.qty,
          type: 'return-in',
          refReturnId: ret.id,
          note: `${state.shops.find((x) => x.id === data.shopId)?.name ?? '店铺'} 退货回收`,
        };
        set((s) => ({ returns: [...s.returns, ret], movements: [...s.movements, inbound] }));
        return ret.id;
      },

      deleteReturn: (id) => {
        const state = get();
        const old = state.returns.find((x) => x.id === id);
        if (!old) return;
        requireUnlocked(state, old.shopId, old.date, '删除退货单');
        // 若回收的货已经又送出去，删掉退货会导致手头库存为负 → 拒绝
        const onHandExcluding = onHandWithoutReturn(state, id);
        const remain = onHandExcluding.get(stockKey(old.styleId, old.colorId)) ?? 0;
        if (remain < 0) throw new ConsignmentError('退回来的货已经重新送出，不能删除该退货单');
        set((s) => ({
          returns: s.returns.filter((x) => x.id !== id),
          movements: s.movements.filter((m) => m.refReturnId !== id),
        }));
      },

      getDraftSettlement: (shopId, period) => buildSettlement(get(), shopId, period),

      saveReport: (shopId, period, report) => {
        const state = get();
        if (isMonthLocked(state, shopId, period)) {
          throw new ConsignmentError(`${period} 已结账，不能再录入对方报数`);
        }
        const fresh = buildSettlement(state, shopId, period);
        for (const line of fresh.lines) {
          const rep = report[stockKey(line.styleId, line.colorId)];
          if (!rep) continue;
          for (const slot of REPORT_SLOT_KEYS) {
            if (slot in rep) line[slot] = rep[slot] ?? null;
          }
          line.diffs = diffsForLine(line);
        }
        upsertSettlement(set, fresh);
      },

      confirmSettlement: (shopId, period, note) => {
        const state = get();
        if (isMonthLocked(state, shopId, period)) throw new ConsignmentError('该月已经结账，不能重复结账');
        if (isPeriodBlockedByFutureSettlement(state, shopId, period)) {
          throw new ConsignmentError('已有更晚月份结账，请先按时间顺序核对本月');
        }
        const existing = state.settlements.find((s) => s.shopId === shopId && s.period === period);
        const fresh = buildSettlement(state, shopId, period);
        // 保留已录入的对方报数
        if (existing) {
          for (const line of fresh.lines) {
            const oldLine = existing.lines.find((l) => stockKey(l.styleId, l.colorId) === stockKey(line.styleId, line.colorId));
            if (oldLine) {
              line.reportOpening = oldLine.reportOpening;
              line.reportDelivered = oldLine.reportDelivered;
              line.reportSold = oldLine.reportSold;
              line.reportReturned = oldLine.reportReturned;
              line.reportEnding = oldLine.reportEnding;
              line.diffs = diffsForLine(line);
            }
          }
        }
        const confirmed: Settlement = {
          ...fresh,
          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          note: note?.trim() || existing?.note,
        };
        // 结账后把本月单据相关的改价说明钉到这张对账单上（永久保留、不可再改）
        const stampIds = collectAdjustmentIdsForPeriod(state, shopId, period);
        set((s) => ({
          settlements: [...s.settlements.filter((x) => !(x.shopId === shopId && x.period === period)), confirmed],
          adjustments: s.adjustments.map((a) => (stampIds.has(a.id) ? { ...a, settlementId: confirmed.id } : a)),
        }));
      },
    }),
    {
      name: 'knitting-consignment-storage',
    },
  ),
);

function upsertSettlement(
  set: (fn: (s: ConsignmentState) => Partial<ConsignmentState>) => void,
  next: Settlement,
) {
  set((s) => ({
    settlements: [...s.settlements.filter((x) => !(x.shopId === next.shopId && x.period === next.period)), next],
  }));
}

/** 某店各 SKU 当前在店库存 */
function shopStockAt(state: ConsignmentState, shopId: string): Map<string, number> {
  const map = new Map<string, number>();
  const add = (k: string, q: number) => map.set(k, (map.get(k) ?? 0) + q);
  for (const d of state.deliveries) {
    if (d.shopId !== shopId) continue;
    for (const l of d.lines) add(stockKey(l.styleId, l.colorId), l.qty);
  }
  for (const x of state.sales) if (x.shopId === shopId) add(stockKey(x.styleId, x.colorId), -x.qty);
  for (const x of state.returns) if (x.shopId === shopId) add(stockKey(x.styleId, x.colorId), -x.qty);
  return map;
}

function latestDeliveryPrice(state: ConsignmentState, shopId: string, styleId: string, colorId: string): number | null {
  const hits = state.deliveries
    .filter((d) => d.shopId === shopId)
    .flatMap((d) => d.lines.filter((l) => l.styleId === styleId && l.colorId === colorId).map((l) => ({ date: d.date, price: l.unitPrice })))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return hits[0]?.price ?? null;
}

/** 收集归属于某店某月单据的改价说明 id（按被引用单据的实际月份） */
function collectAdjustmentIdsForPeriod(state: ConsignmentState, shopId: string, period: string): Set<string> {
  const ids = new Set<string>();
  for (const a of state.adjustments) {
    if (a.shopId !== shopId) continue;
    let m: string | null = null;
    if (a.kind === 'sale') {
      m = state.sales.find((x) => x.id === a.refId)?.date.slice(0, 7) ?? monthOf(a.date);
    } else {
      m = state.deliveries.find((d) => d.id === a.refId)?.date.slice(0, 7) ?? monthOf(a.date);
    }
    if (m === period) ids.add(a.id);
  }
  return ids;
}

/** 排除某张退货单的回收量后的手头库存（用于删除退货的占用校验） */
function onHandWithoutReturn(state: ConsignmentState, returnId: string): Map<string, number> {
  const map = new Map<string, number>();
  const add = (k: string, q: number) => map.set(k, (map.get(k) ?? 0) + q);
  for (const m of state.movements) {
    if (m.refReturnId === returnId) continue;
    if (m.type === 'produce' || m.type === 'return-in') add(stockKey(m.styleId, m.colorId), m.qty);
  }
  for (const d of state.deliveries) for (const l of d.lines) add(stockKey(l.styleId, l.colorId), -l.qty);
  return map;
}
