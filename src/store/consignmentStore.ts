import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConsignmentData,
  Delivery,
  DeliveryLine,
  PriceChange,
  Product,
  ReturnRecord,
  Settlement,
  Shop,
  StockIn,
} from '../types/consignment';
import {
  availableStock,
  buildSettlementLine,
  confirmedClosing,
  currentPeriod,
  findProduct,
  latestConfirmed,
  onShopFloor,
  pendingMovements,
  periodEnd,
  round2,
  uid,
} from '../utils/consignment';

type DraftLineInput = { productId: string; qty: number; price?: number; ourShare?: number };
type DraftReturnLine = { productId: string; qty: number };

interface ConsignmentState extends ConsignmentData {
  // 小店
  addShop: (input: Omit<Shop, 'id' | 'createdAt'>) => void;
  updateShop: (id: string, patch: Partial<Omit<Shop, 'id' | 'createdAt'>>) => void;
  deleteShop: (id: string) => void;

  // 款式
  addProduct: (input: { style: string; color: string; tagPrice: number; note?: string }) => void;
  updateProduct: (id: string, patch: Partial<Pick<Product, 'style' | 'color' | 'note'>>) => void;
  changeProductPrice: (id: string, to: number, reason: string) => void;
  deleteProduct: (id: string) => void;

  // 入库
  addStockIn: (input: Omit<StockIn, 'id'>) => void;
  deleteStockIn: (id: string) => void;

  // 送货
  addDelivery: (input: { date: string; shopId: string; lines: DraftLineInput[]; note?: string }) => void;
  updateDeliveryMeta: (id: string, patch: { date?: string; note?: string }) => void;
  updateDeliveryLine: (
    id: string,
    productId: string,
    patch: { qty?: number; price?: number; ourShare?: number },
    priceReason?: string
  ) => void;
  deleteDelivery: (id: string) => void;

  // 退货
  addReturn: (input: { date: string; shopId: string; lines: DraftReturnLine[]; note?: string }) => void;
  updateReturnMeta: (id: string, patch: { date?: string; note?: string }) => void;
  updateReturnLine: (id: string, productId: string, qty: number) => void;
  deleteReturn: (id: string) => void;

  // 对账
  createSettlement: (shopId: string, period: string) => string | { error: string };
  updateSettlementReport: (
    id: string,
    productId: string,
    patch: Partial<{ sold: number; returned: number; closing: number }>
  ) => void;
  updateSettlementLinePrice: (
    id: string,
    productId: string,
    patch: { price?: number; ourShare?: number },
    priceReason?: string
  ) => void;
  setDiscrepancyNote: (id: string, note: string) => void;
  confirmSettlement: (id: string) => void | { error: string };
  deleteSettlement: (id: string) => void;

  // 演示数据
  seedDemo: () => void;
  resetAll: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function changePrice(prev: number, to: number, reason: string): PriceChange {
  return { at: nowIso(), from: prev, to, reason: reason.trim() };
}

/** 重新计算一张对账单所有行（草稿） */
function recomputeSettlement(data: ConsignmentData, st: Settlement): Settlement {
  const end = periodEnd(st.period);
  const pend = pendingMovements(data, st.shopId, end);

  // 参与本行的款式：期初>0、本期有送货/退货、对方有报数、有手工改价
  const productIds = new Set<string>();
  data.products.forEach((p) => productIds.add(p.id));
  pend.deliveries.forEach((d) => d.lines.forEach((l) => productIds.add(l.productId)));
  pend.returns.forEach((r) => r.lines.forEach((l) => productIds.add(l.productId)));
  Object.keys(st.reports).forEach((k) => productIds.add(k));
  Object.keys(st.lineEdits).forEach((k) => productIds.add(k));

  const lines = [...productIds]
    .map((productId) => {
      const product = findProduct(data, productId);
      const opening = confirmedClosing(data, st.shopId, productId);
      const delivered = pend.deliveries.reduce(
        (sum, d) => sum + (d.lines.find((l) => l.productId === productId)?.qty ?? 0),
        0
      );
      const returned = pend.returns.reduce(
        (sum, r) => sum + (r.lines.find((l) => l.productId === productId)?.qty ?? 0),
        0
      );
      const report = st.reports[productId] ?? { sold: 0, returned: 0, closing: 0 };

      // 默认单价/分成：取本期送货单里最近一笔；没有送货则用款式标价与小店默认比例
      const deliveriesWithLine = pend.deliveries
        .filter((d) => d.lines.some((l) => l.productId === productId))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const latestLine: DeliveryLine | undefined = deliveriesWithLine
        .map((d) => d.lines.find((l) => l.productId === productId)!)
        [0];
      const shop = data.shops.find((s) => s.id === st.shopId);
      let price = latestLine?.price ?? product?.tagPrice ?? 0;
      let ourShare = latestLine?.ourShare ?? shop?.defaultOurShare ?? 0.6;
      const edit = st.lineEdits[productId];
      if (edit) {
        if (edit.price !== undefined) price = edit.price;
        if (edit.ourShare !== undefined) ourShare = edit.ourShare;
      }

      const line = buildSettlementLine({
        productId,
        opening,
        delivered,
        returned,
        reportSold: report.sold,
        reportReturned: report.returned,
        reportClosing: report.closing,
        price,
        ourShare,
      });
      return line;
    })
    .filter(
      (l) =>
        l.opening > 0 ||
        l.delivered > 0 ||
        l.returned > 0 ||
        l.reportSold > 0 ||
        l.reportReturned > 0 ||
        l.reportClosing > 0 ||
        st.lineEdits[l.productId] !== undefined
    )
    .sort((a, b) => (a.productId < b.productId ? -1 : 1));

  return { ...st, lines };
}

/** 改完单据后，把受影响的草稿账单重算 */
function refreshDrafts(data: ConsignmentData): Settlement[] {
  return data.settlements.map((s) =>
    s.status === 'draft' ? recomputeSettlement(data, s) : s
  );
}

export const useConsignmentStore = create<ConsignmentState>()(
  persist(
    (set, get) => {
      /** 在最新 state 上重算某张草稿并写回 */
      const patchSettlement = (id: string, fn: (st: Settlement) => Settlement) => {
        set((s) => ({
          settlements: s.settlements.map((st) => {
            if (st.id !== id || st.status === 'confirmed') return st;
            const next = fn(st);
            return recomputeSettlement(s, next);
          }),
        }));
      };

      return {
        shops: [],
        products: [],
        stockIns: [],
        deliveries: [],
        returns: [],
        settlements: [],

        // ---------- 小店 ----------
        addShop: (input) =>
          set((s) => ({
            shops: [...s.shops, { ...input, id: uid('sh_'), createdAt: nowIso() }],
          })),

        updateShop: (id, patch) =>
          set((s) => ({
            shops: s.shops.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
          })),

        deleteShop: (id) => {
          const s = get();
          if (
            s.deliveries.some((d) => d.shopId === id) ||
            s.returns.some((r) => r.shopId === id) ||
            s.settlements.some((st) => st.shopId === id)
          ) {
            throw new Error('该店已有送货/退货/对账记录，不能删除（可改名停用）');
          }
          set((st) => ({ shops: st.shops.filter((sh) => sh.id !== id) }));
        },

        // ---------- 款式 ----------
        addProduct: ({ style, color, tagPrice, note }) =>
          set((s) => ({
            products: [
              ...s.products,
              {
                id: uid('p_'),
                style: style.trim(),
                color: color.trim(),
                tagPrice,
                note,
                priceChanges: [],
                createdAt: nowIso(),
              },
            ],
          })),

        updateProduct: (id, patch) =>
          set((s) => ({
            products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),

        changeProductPrice: (id, to, reason) => {
          const trimmed = reason.trim();
          if (!trimmed) throw new Error('改价必须填写说明');
          if (!(to > 0)) throw new Error('价格必须大于 0');
          set((s) => ({
            products: s.products.map((p) => {
              if (p.id !== id) return p;
              if (round2(p.tagPrice) === round2(to)) return p;
              return {
                ...p,
                tagPrice: to,
                priceChanges: [...p.priceChanges, changePrice(p.tagPrice, to, trimmed)],
              };
            }),
          }));
        },

        deleteProduct: (id) => {
          const s = get();
          if (
            s.stockIns.some((si) => si.productId === id) ||
            s.deliveries.some((d) => d.lines.some((l) => l.productId === id)) ||
            s.returns.some((r) => r.lines.some((l) => l.productId === id))
          ) {
            throw new Error('该款已有入库/送货/退货记录，不能删除');
          }
          set((st) => ({ products: st.products.filter((p) => p.id !== id) }));
        },

        // ---------- 入库 ----------
        addStockIn: (input) => {
          if (!(input.qty > 0)) throw new Error('入库件数必须大于 0');
          set((s) => ({
            stockIns: [...s.stockIns, { ...input, qty: Math.floor(input.qty), id: uid('in_') }],
          }));
        },

        deleteStockIn: (id) => {
          const s = get();
          const target = s.stockIns.find((si) => si.id === id);
          if (!target) return;
          // 删了这笔之后库存不能变负（各店在店件数不变，但总入库减少）
          const inboundAfter = s.stockIns
            .filter((si) => si.id !== id && si.productId === target.productId)
            .reduce((sum, si) => sum + si.qty, 0);
          const inShops = s.shops.reduce(
            (sum, sh) => sum + onShopFloor(s, sh.id, target.productId),
            0
          );
          if (inboundAfter < inShops) {
            throw new Error('删除后入库总数少于各店在卖件数，不能删除');
          }
          set((st) => ({ stockIns: st.stockIns.filter((si) => si.id !== id) }));
        },

        // ---------- 送货 ----------
        addDelivery: ({ date, shopId, lines, note }) => {
          const s = get();
          const valid = lines
            .map((l) => ({ ...l, qty: Math.floor(l.qty) }))
            .filter((l) => l.qty > 0);
          if (valid.length === 0) throw new Error('至少填写一行、件数大于 0');
          // 库存校验：同款合并后不能超过手上可用件数
          const need = new Map<string, number>();
          valid.forEach((l) => need.set(l.productId, (need.get(l.productId) ?? 0) + l.qty));
          for (const [productId, qty] of need) {
            const avail = availableStock(s, productId);
            if (qty > avail) {
              const p = findProduct(s, productId);
              throw new Error(
                `${p ? `${p.style}·${p.color}` : '该款'} 手上可用只有 ${avail} 件，送不出 ${qty} 件`
              );
            }
          }
          const shop = s.shops.find((sh) => sh.id === shopId);
          if (!shop) throw new Error('请选择小店');
          const finalLines: DeliveryLine[] = valid.map((l) => {
            const product = findProduct(s, l.productId)!;
            const price = l.price ?? product.tagPrice;
            const ourShare = l.ourShare ?? shop.defaultOurShare;
            return { productId: l.productId, qty: l.qty, price, ourShare, priceChanges: [] };
          });
          const delivery: Delivery = {
            id: uid('dl_'),
            date,
            shopId,
            lines: finalLines,
            note,
            createdAt: nowIso(),
          };
          set((st) => {
            const next: ConsignmentData = { ...st, deliveries: [...st.deliveries, delivery] };
            return { deliveries: next.deliveries, settlements: refreshDrafts(next) };
          });
        },

        updateDeliveryMeta: (id, patch) => {
          const s = get();
          const d = s.deliveries.find((x) => x.id === id);
          if (!d) return;
          if (d.settlementId) throw new Error('这批已经结过账，不许再改');
          if (patch.date) {
            const last = latestConfirmed(s, d.shopId);
            if (last && patch.date <= periodEnd(last.period)) {
              throw new Error(`日期不能早于已结账期（${last.period}）`);
            }
          }
          set((st) => {
            const deliveries = st.deliveries.map((x) =>
              x.id === id ? { ...x, ...patch } : x
            );
            const next = { ...st, deliveries };
            return { deliveries, settlements: refreshDrafts(next) };
          });
        },

        updateDeliveryLine: (id, productId, patch, priceReason) => {
          const s = get();
          const d = s.deliveries.find((x) => x.id === id);
          if (!d) return;
          if (d.settlementId) throw new Error('这批已经结过账，不许再改');
          if (patch.qty !== undefined) {
            const newQty = Math.floor(patch.qty);
            // 该单原占的件数先还回可用池，再按新数量校验
            const oldQty = d.lines.find((l) => l.productId === productId)?.qty ?? 0;
            const avail = availableStock(s, productId) + oldQty;
            if (newQty > avail) {
              throw new Error(`手上可用只有 ${avail} 件`);
            }
          }
          set((st) => {
            const deliveries = st.deliveries.map((x) => {
              if (x.id !== id) return x;
              return {
                ...x,
                lines: x.lines.map((l) => {
                  if (l.productId !== productId) return l;
                  const next = { ...l };
                  if (patch.qty !== undefined) next.qty = Math.max(0, Math.floor(patch.qty));
                  if (patch.ourShare !== undefined)
                    next.ourShare = Math.min(1, Math.max(0, patch.ourShare));
                  if (patch.price !== undefined) {
                    const to = patch.price;
                    if (!(to > 0)) throw new Error('价格必须大于 0');
                    if (round2(to) !== round2(l.price)) {
                      if (!priceReason?.trim()) throw new Error('改价必须填写一次说明');
                      next.priceChanges = [
                        ...l.priceChanges,
                        changePrice(l.price, to, priceReason),
                      ];
                      next.price = to;
                    }
                  }
                  return next;
                }),
              };
            });
            const next = { ...st, deliveries };
            return { deliveries, settlements: refreshDrafts(next) };
          });
        },

        deleteDelivery: (id) => {
          const s = get();
          const d = s.deliveries.find((x) => x.id === id);
          if (!d) return;
          if (d.settlementId) throw new Error('这批已经结过账，不许再改');
          set((st) => {
            const deliveries = st.deliveries.filter((x) => x.id !== id);
            const next = { ...st, deliveries };
            return { deliveries, settlements: refreshDrafts(next) };
          });
        },

        // ---------- 退货 ----------
        addReturn: ({ date, shopId, lines, note }) => {
          const s = get();
          const valid = lines
            .map((l) => ({ ...l, qty: Math.floor(l.qty) }))
            .filter((l) => l.qty > 0);
          if (valid.length === 0) throw new Error('至少填写一行、件数大于 0');
          // 不能退得比店里现有的还多
          for (const l of valid) {
            const floor = onShopFloor(s, shopId, l.productId);
            if (l.qty > floor) {
              const p = findProduct(s, l.productId);
              throw new Error(
                `${p ? `${p.style}·${p.color}` : '该款'} 店里只剩 ${floor} 件，退不出 ${l.qty} 件`
              );
            }
          }
          const rec: ReturnRecord = {
            id: uid('rt_'),
            date,
            shopId,
            lines: valid.map((l) => ({ productId: l.productId, qty: l.qty })),
            note,
            createdAt: nowIso(),
          };
          set((st) => {
            const next: ConsignmentData = { ...st, returns: [...st.returns, rec] };
            return { returns: next.returns, settlements: refreshDrafts(next) };
          });
        },

        updateReturnMeta: (id, patch) => {
          const s = get();
          const r = s.returns.find((x) => x.id === id);
          if (!r) return;
          if (r.settlementId) throw new Error('这批退货已经结过账，不许再改');
          if (patch.date) {
            const last = latestConfirmed(s, r.shopId);
            if (last && patch.date <= periodEnd(last.period)) {
              throw new Error(`日期不能早于已结账期（${last.period}）`);
            }
          }
          set((st) => {
            const returns = st.returns.map((x) => (x.id === id ? { ...x, ...patch } : x));
            const next = { ...st, returns };
            return { returns, settlements: refreshDrafts(next) };
          });
        },

        updateReturnLine: (id, productId, qty) => {
          const s = get();
          const r = s.returns.find((x) => x.id === id);
          if (!r) return;
          if (r.settlementId) throw new Error('这批退货已经结过账，不许再改');
          const newQty = Math.max(0, Math.floor(qty));
          // 把该单自身先还回店里，再校验
          const oldQty = r.lines.find((l) => l.productId === productId)?.qty ?? 0;
          const floor = onShopFloor(s, r.shopId, productId) + oldQty;
          if (newQty > floor) throw new Error(`店里最多可退 ${floor} 件`);
          set((st) => {
            const returns = st.returns.map((x) =>
              x.id === id
                ? {
                    ...x,
                    lines: x.lines
                      .map((l) => (l.productId === productId ? { ...l, qty: newQty } : l))
                      .filter((l) => l.qty > 0),
                  }
                : x
            );
            const next = { ...st, returns };
            return { returns, settlements: refreshDrafts(next) };
          });
        },

        deleteReturn: (id) => {
          const s = get();
          const r = s.returns.find((x) => x.id === id);
          if (!r) return;
          if (r.settlementId) throw new Error('这批退货已经结过账，不许再改');
          set((st) => {
            const returns = st.returns.filter((x) => x.id !== id);
            const next = { ...st, returns };
            return { returns, settlements: refreshDrafts(next) };
          });
        },

        // ---------- 对账 ----------
        createSettlement: (shopId, period) => {
          const s = get();
          if (!/^\d{4}-\d{2}$/.test(period)) return { error: '账期格式不正确' };
          const last = latestConfirmed(s, shopId);
          if (last && period <= last.period) {
            return { error: `已结到 ${last.period}，新账期必须在它之后` };
          }
          if (s.settlements.some((st) => st.shopId === shopId && st.period === period)) {
            return { error: '该店这个月已有对账单（草稿或已确认）' };
          }
          if (s.settlements.some((st) => st.shopId === shopId && st.status === 'draft')) {
            return { error: '该店还有一张未确认的草稿账单，请先确认或删除它' };
          }
          const end = periodEnd(period);
          const pend = pendingMovements(s, shopId, end);
          if (pend.deliveries.length === 0 && pend.returns.length === 0 && !last) {
            return { error: '这个月该店没有未结账的送货或退货记录' };
          }
          const draft: Settlement = {
            id: uid('st_'),
            shopId,
            period,
            status: 'draft',
            lines: [],
            lineEdits: {},
            reports: {},
            discrepancyNote: '',
            createdAt: nowIso(),
          };
          const computed = recomputeSettlement(s, draft);
          set((st) => ({ settlements: [...st.settlements, computed] }));
          return draft.id;
        },

        updateSettlementReport: (id, productId, patch) =>
          patchSettlement(id, (st) => {
            const prev = st.reports[productId] ?? { sold: 0, returned: 0, closing: 0 };
            const next = {
              sold: Math.max(0, Math.floor(patch.sold ?? prev.sold)),
              returned: Math.max(0, Math.floor(patch.returned ?? prev.returned)),
              closing: Math.max(0, Math.floor(patch.closing ?? prev.closing)),
            };
            return { ...st, reports: { ...st.reports, [productId]: next } };
          }),

        updateSettlementLinePrice: (id, productId, patch, priceReason) =>
          patchSettlement(id, (st) => {
            const prevEdit = st.lineEdits[productId] ?? { priceChanges: [] };
            // 先算出当前生效价
            const currentLine = st.lines.find((l) => l.productId === productId);
            const currentPrice = currentLine?.price ?? 0;
            const currentShare = currentLine?.ourShare ?? 0;
            const priceChanges = [...prevEdit.priceChanges];
            if (patch.price !== undefined && round2(patch.price) !== round2(currentPrice)) {
              if (!(patch.price > 0)) throw new Error('价格必须大于 0');
              if (!priceReason?.trim()) throw new Error('改价必须填写一次说明');
              priceChanges.push(changePrice(currentPrice, patch.price, priceReason));
            }
            return {
              ...st,
              lineEdits: {
                ...st.lineEdits,
                [productId]: {
                  price: patch.price ?? currentPrice,
                  ourShare: patch.ourShare ?? currentShare,
                  priceChanges,
                },
              },
            };
          }),

        setDiscrepancyNote: (id, note) =>
          set((s) => ({
            settlements: s.settlements.map((st) =>
              st.id === id ? { ...st, discrepancyNote: note } : st
            ),
          })),

        confirmSettlement: (id) => {
          const s = get();
          const st = s.settlements.find((x) => x.id === id);
          if (!st) return { error: '对账单不存在' };
          if (st.status === 'confirmed') return { error: '已经结账，不能重复确认' };
          const totals = st.lines;
          const discrepancyCount = totals.reduce((n, l) => n + l.discrepancies.length, 0);
          if (discrepancyCount > 0 && !st.discrepancyNote.trim()) {
            return { error: '还有对不上的数目，请先填写差异处理说明再结账' };
          }
          const end = periodEnd(st.period);
          const last = latestConfirmed(s, st.shopId);
          if (last && st.period <= last.period) {
            return { error: `已结到 ${last.period}，不能确认更早的账期` };
          }
          set((state) => {
            const settlementId = st.id;
            return {
              deliveries: state.deliveries.map((d) =>
                d.shopId === st.shopId && !d.settlementId && d.date <= end
                  ? { ...d, settlementId }
                  : d
              ),
              returns: state.returns.map((r) =>
                r.shopId === st.shopId && !r.settlementId && r.date <= end
                  ? { ...r, settlementId }
                  : r
              ),
              settlements: state.settlements.map((x) =>
                x.id === id
                  ? { ...x, status: 'confirmed' as const, confirmedAt: nowIso() }
                  : x
              ),
            };
          });
        },

        deleteSettlement: (id) => {
          const s = get();
          const st = s.settlements.find((x) => x.id === id);
          if (!st) return;
          if (st.status === 'confirmed') throw new Error('已结账的对账单不能删除');
          set((state) => ({
            settlements: state.settlements.filter((x) => x.id !== id),
          }));
        },

        // ---------- 演示数据 ----------
        seedDemo: () => {
          const s = get();
          if (s.shops.length > 0 || s.products.length > 0) return;
          const shopA: Shop = {
            id: uid('sh_'),
            name: '梧桐手作铺',
            contact: '林姐',
            phone: '138-0000-1111',
            defaultOurShare: 0.6,
            note: '每月 1 号对账',
            createdAt: nowIso(),
          };
          const shopB: Shop = {
            id: uid('sh_'),
            name: '巷子口杂货店',
            contact: '阿海',
            phone: '139-0000-2222',
            defaultOurShare: 0.55,
            createdAt: nowIso(),
          };
          const mkProduct = (style: string, color: string, tagPrice: number): Product => ({
            id: uid('p_'),
            style,
            color,
            tagPrice,
            priceChanges: [],
            createdAt: nowIso(),
          });
          const p1 = mkProduct('云朵围巾', '奶白', 120);
          const p2 = mkProduct('云朵围巾', '雾蓝', 120);
          const p3 = mkProduct('豆豆帽', '焦糖', 88);
          const period = currentPeriod();
          const d1 = `${period}-03`;
          const d2 = `${period}-05`;
          const dr = `${period}-24`;

          const stockIns: StockIn[] = [
            { id: uid('in_'), date: d1, productId: p1.id, qty: 10 },
            { id: uid('in_'), date: d1, productId: p2.id, qty: 8 },
            { id: uid('in_'), date: d2, productId: p3.id, qty: 12 },
          ];

          const dl1: Delivery = {
            id: uid('dl_'),
            date: d1,
            shopId: shopA.id,
            lines: [
              { productId: p1.id, qty: 5, price: 120, ourShare: 0.6, priceChanges: [] },
              { productId: p2.id, qty: 3, price: 120, ourShare: 0.6, priceChanges: [] },
              { productId: p3.id, qty: 4, price: 88, ourShare: 0.6, priceChanges: [] },
            ],
            createdAt: nowIso(),
          };
          const dl2: Delivery = {
            id: uid('dl_'),
            date: d2,
            shopId: shopB.id,
            lines: [
              { productId: p1.id, qty: 3, price: 130, ourShare: 0.55, priceChanges: [] },
              { productId: p3.id, qty: 5, price: 90, ourShare: 0.55, priceChanges: [] },
            ],
            createdAt: nowIso(),
          };
          const rt1: ReturnRecord = {
            id: uid('rt_'),
            date: dr,
            shopId: shopA.id,
            lines: [{ productId: p2.id, qty: 1 }],
            note: '店里挂久了，先退回',
            createdAt: nowIso(),
          };

          set({
            shops: [shopA, shopB],
            products: [p1, p2, p3],
            stockIns,
            deliveries: [dl1, dl2],
            returns: [rt1],
            settlements: [],
          });
        },

        resetAll: () =>
          set({
            shops: [],
            products: [],
            stockIns: [],
            deliveries: [],
            returns: [],
            settlements: [],
          }),
      };
    },
    {
      name: 'knitting-consignment-storage',
    }
  )
);

export type { ConsignmentData };
