// ===== 寄售对账领域模型 =====

/** 改价记录：任何一次改价都必须留一次说明 */
export type PriceChange = {
  at: string; // ISO 时间
  from: number;
  to: number;
  reason: string;
};

/** 寄售小店 */
export type Shop = {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  note?: string;
  /** 我方默认分成比例，0~1，例如 0.6 表示卖 100 我方拿 60 */
  defaultOurShare: number;
  createdAt: string;
};

/** 款式 + 颜色 = 一种成品（同款不同色分开记账） */
export type Product = {
  id: string;
  style: string; // 款式
  color: string; // 颜色
  tagPrice: number; // 当前标价
  note?: string;
  /** 标价调整历史（改价必须填原因） */
  priceChanges: PriceChange[];
  createdAt: string;
};

/** 成品入库（织好的成品先入自己手上的库存） */
export type StockIn = {
  id: string;
  date: string; // YYYY-MM-DD
  productId: string;
  qty: number;
  note?: string;
};

export type DeliveryLine = {
  productId: string;
  qty: number;
  /** 本批约定售价 */
  price: number;
  /** 本批我方分成比例 */
  ourShare: number;
  /** 本批改价历史 */
  priceChanges: PriceChange[];
};

/** 送货单：一次往某家店送若干款若干件 */
export type Delivery = {
  id: string;
  date: string; // YYYY-MM-DD
  shopId: string;
  lines: DeliveryLine[];
  note?: string;
  /** 被哪张对账单占用/锁定；已结账的单据不可改 */
  settlementId?: string;
  createdAt: string;
};

export type ReturnLine = {
  productId: string;
  /** 实际退回到手的件数 */
  qty: number;
};

/** 退货单：某家店实际退回来的件（退回后可再送到别家） */
export type ReturnRecord = {
  id: string;
  date: string;
  shopId: string;
  lines: ReturnLine[];
  note?: string;
  settlementId?: string;
  createdAt: string;
};

export type DiscrepancyKind = 'flow' | 'returns';

/** 一条对账差异，写清差在哪 */
export type Discrepancy = {
  productId: string;
  kind: DiscrepancyKind;
  expected: number;
  reported: number;
  /** reported - expected，正数对方多报、负数少报 */
  diff: number;
  message: string;
};

export type SettlementLine = {
  productId: string;
  /** 期初店里剩的（上张已结账单的期末店存） */
  opening: number;
  /** 本期送货（本单涵盖的未结送货单） */
  delivered: number;
  /** 本期我方实际收到的退货 */
  returned: number;
  /** 对方报来的卖出件数 */
  reportSold: number;
  /** 对方报来的退货件数 */
  reportReturned: number;
  /** 对方报来的月底店存 */
  reportClosing: number;
  /** 我方按账算出来的店存 = 期初 + 送 − 退 − 对方报卖 */
  bookClosing: number;
  price: number;
  ourShare: number;
  /** 我方应得 = 对方报卖 × 单价 × 我方比例 */
  ourAmount: number;
  shopAmount: number;
  discrepancies: Discrepancy[];
};

export type Settlement = {
  id: string;
  shopId: string;
  period: string; // YYYY-MM
  status: 'draft' | 'confirmed';
  lines: SettlementLine[];
  /** 每行可临时改价/改分成；改价带说明 */
  lineEdits: Record<string, { price?: number; ourShare?: number; priceChanges: PriceChange[] }>;
  /** 对方报数录入 */
  reports: Record<string, { sold: number; returned: number; closing: number }>;
  /** 对不上时的处理说明（有差异则确认结账必填） */
  discrepancyNote: string;
  confirmedAt?: string;
  createdAt: string;
};

/** 纯逻辑函数依赖的最小数据形状 */
export interface ConsignmentData {
  shops: Shop[];
  products: Product[];
  stockIns: StockIn[];
  deliveries: Delivery[];
  returns: ReturnRecord[];
  settlements: Settlement[];
}
