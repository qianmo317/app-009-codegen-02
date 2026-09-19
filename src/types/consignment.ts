// 寄售对账领域模型
// 纯数据结构，可直接 JSON 序列化（localStorage 持久化）

/** 小店（寄售方） */
export interface Shop {
  id: string;
  name: string;
  contact?: string;
  /** 店家分成比例，0~1 之间；我方应得 = 销售额 × (1 - commissionRate) */
  commissionRate: number;
  note?: string;
  createdAt: string;
}

/** 款式 */
export interface Style {
  id: string;
  name: string;
  note?: string;
}

/** 颜色（全店共用一本颜色字典） */
export interface ColorDef {
  id: string;
  name: string;
}

/** 库存变动类型：produce=织好成品入库；return-in=店家退货回收（系统自动生成） */
export type StockMoveType = 'produce' | 'return-in';

export interface StockMovement {
  id: string;
  date: string; // YYYY-MM-DD
  styleId: string;
  colorId: string;
  qty: number;
  type: StockMoveType;
  /** return-in 时关联的退货单 id */
  refReturnId?: string;
  note?: string;
}

/** 送货单明细行：同一送货单里同一 SKU 只出现一行 */
export interface DeliveryLine {
  styleId: string;
  colorId: string;
  qty: number;
  /** 与店家约定的售价 */
  unitPrice: number;
}

/** 送货单：每次送去几家小店，逐笔记 */
export interface Delivery {
  id: string;
  shopId: string;
  date: string; // YYYY-MM-DD
  lines: DeliveryLine[];
  note?: string;
}

/** 售出记录：按 店铺×款式×颜色 分开记账 */
export interface Sale {
  id: string;
  shopId: string;
  date: string; // YYYY-MM-DD
  styleId: string;
  colorId: string;
  qty: number;
  /** 实际成交价；与约定价不同须附调价说明 */
  unitPrice: number;
}

/** 退货单：没卖掉的退回来（退回后自动回库，可再送往别家） */
export interface ReturnVoucher {
  id: string;
  shopId: string;
  date: string;
  styleId: string;
  colorId: string;
  qty: number;
  note?: string;
}

/**
 * 调价说明：任何改价都必须走一次说明。
 * kind=delivery 修改某张送货单的约定价；kind=sale 实际售价与约定价不同。
 * 对账确认时归入对应对账单（settlementId），已结账后永久保留、不可改。
 */
export interface PriceAdjustment {
  id: string;
  shopId: string;
  date: string;
  styleId: string;
  colorId: string;
  kind: 'delivery' | 'sale';
  oldPrice: number;
  newPrice: number;
  reason: string;
  /** delivery: 送货单 id；sale: 售出记录 id */
  refId: string;
  /** 归属的已确认对账单；未确认前为空 */
  settlementId?: string;
  createdAt: string;
}

/** 对账单里一个 SKU（款式+颜色）的对账行 */
export interface SettlementLine {
  styleId: string;
  colorId: string;
  // —— 我方账面数 ——
  opening: number; // 月初店里余货
  delivered: number; // 本月送出
  sold: number; // 我方记卖出
  returned: number; // 我方记退回
  ending: number; // 月末账面 = opening + delivered - sold - returned
  // —— 对方报来的数（手填，缺失表示该项未报） ——
  reportOpening: number | null;
  reportDelivered: number | null;
  reportSold: number | null;
  reportReturned: number | null;
  reportEnding: number | null;
  // —— 金额 ——
  agreedUnitPrice: number; // 约定售价（本月该店该 SKU 最近一次送货价）
  soldAmount: number; // 我方记账销售额（按实际成交价）
  shopShare: number; // 店家分成
  makerAmount: number; // 我方应得
  /** 逐行差异说明（中文人话） */
  diffs: string[];
}

export type SettlementStatus = 'draft' | 'confirmed';

/** 月度对账单：一家店一个月一张 */
export interface Settlement {
  id: string;
  shopId: string;
  period: string; // YYYY-MM
  status: SettlementStatus;
  lines: SettlementLine[];
  confirmedAt?: string;
  note?: string;
}

/** 全部寄售数据（持久化根对象） */
export interface ConsignmentState {
  shops: Shop[];
  styles: Style[];
  colors: ColorDef[];
  movements: StockMovement[];
  deliveries: Delivery[];
  sales: Sale[];
  returns: ReturnVoucher[];
  adjustments: PriceAdjustment[];
  settlements: Settlement[];
}
