/**
 * 寄售月结核心规则验证（一次性脚本，用 tsx 运行，不属于构建产物）：
 *   npx tsx scripts/verify-consignment.ts
 */
import { useConsignmentStore, ConsignmentError } from '../src/store/consignmentStore';
import { buildSettlement, onHandStock, settlementTotals } from '../src/utils/consignment';
import { stockKey } from '../src/utils/consignment';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

function expectThrow(name: string, fn: () => void, fragment?: string) {
  try {
    fn();
    failed++;
    console.error(`  ✗ ${name}（应当抛错但没有）`);
  } catch (e) {
    const msg = e instanceof ConsignmentError ? e.message : String(e);
    if (fragment && !msg.includes(fragment)) {
      failed++;
      console.error(`  ✗ ${name}（报错不含「${fragment}」，实际：${msg}）`);
    } else {
      passed++;
      console.log(`  ✓ ${name}（已拦截：${msg}）`);
    }
  }
}

const store = useConsignmentStore;
const s = store.getState;

// —— 准备基础资料 ——
const shopA = s().addShop({ name: '巷口铺', commissionRate: 0.3 });
const shopB = s().addShop({ name: '市集摊', commissionRate: 0.4 });
const hat = s().addStyle('贝雷帽');
const oat = s().addColor('燕麦色');
const k = stockKey(hat, oat);

console.log('\n[1] 入库与同款式分送两家店');
s().addProduce({ date: '2026-08-02', styleId: hat, colorId: oat, qty: 10 });
check('织好 10 件，手头 10', onHandStock(s()).get(k) === 10);

s().addDelivery({ shopId: shopA, date: '2026-08-05', lines: [{ styleId: hat, colorId: oat, qty: 6, unitPrice: 100 }] });
s().addDelivery({ shopId: shopB, date: '2026-08-06', lines: [{ styleId: hat, colorId: oat, qty: 4, unitPrice: 100 }] });
check('分送 A 6 件、B 4 件后手头 0', onHandStock(s()).get(k) === 0);
expectThrow('库存不足时不允许再送货', () =>
  s().addDelivery({ shopId: shopA, date: '2026-08-07', lines: [{ styleId: hat, colorId: oat, qty: 1, unitPrice: 100 }] }), '库存不足');

console.log('\n[2] 各店分别登记卖出，分成按各店比例');
s().addSale({ shopId: shopA, date: '2026-08-10', styleId: hat, colorId: oat, qty: 4, unitPrice: 100 });
s().addSale({ shopId: shopB, date: '2026-08-11', styleId: hat, colorId: oat, qty: 2, unitPrice: 100 });
const saA = buildSettlement(s(), shopA, '2026-08');
const saB = buildSettlement(s(), shopB, '2026-08');
check('A：送出6 卖出4 期末2', saA.lines[0].delivered === 6 && saA.lines[0].sold === 4 && saA.lines[0].ending === 2);
check('B：送出4 卖出2 期末2', saB.lines[0].delivered === 4 && saB.lines[0].sold === 2 && saB.lines[0].ending === 2);
check('A 分成 30%：店家120 我方280', saA.lines[0].shopShare === 120 && saA.lines[0].makerAmount === 280);
check('B 分成 40%：店家80 我方120', saB.lines[0].shopShare === 80 && saB.lines[0].makerAmount === 120);

console.log('\n[3] B 退货 2 件 → 自动回库 → 再送到 A');
s().addReturn({ shopId: shopB, date: '2026-08-20', styleId: hat, colorId: oat, qty: 2 });
check('退货回收后手头 2 件', onHandStock(s()).get(k) === 2);
s().addDelivery({ shopId: shopA, date: '2026-08-22', lines: [{ styleId: hat, colorId: oat, qty: 2, unitPrice: 100 }] });
check('退回的 2 件已转送到 A，手头归 0', onHandStock(s()).get(k) === 0);
const saA2 = buildSettlement(s(), shopA, '2026-08');
const saB2 = buildSettlement(s(), shopB, '2026-08');
check('A：送出 8（6+2）、卖出 4、期末 4', saA2.lines[0].delivered === 8 && saA2.lines[0].ending === 4);
check('B：送出 4、卖出 2、退回 2、期末 0', saB2.lines[0].returned === 2 && saB2.lines[0].ending === 0);
expectThrow('退货不能超过在店数', () =>
  s().addReturn({ shopId: shopB, date: '2026-08-21', styleId: hat, colorId: oat, qty: 1 }), '在店库存只有 0');

console.log('\n[4] 对方报数核对，对不上的列出差异');
s().saveReport(shopA, '2026-08', { [k]: { reportOpening: 0, reportDelivered: 8, reportSold: 3, reportReturned: 0, reportEnding: 4 } });
const draftA = buildSettlement(s(), shopA, '2026-08');
const lineA = draftA.lines[0];
check('卖出差 1 件被识别', lineA.diffs.some((d) => d.includes('本月卖出差 1') && d.includes('对方少报')));
check('一致的项不报差异', !lineA.diffs.some((d) => d.includes('本月送出')));
// 对方数自身钩稽不平：0+8-3-0=5 但报期末 4
check('对方报数自身不平也会提示', lineA.diffs.some((d) => d.includes('对不平')));

console.log('\n[5] 改价必须走说明');
const dA1 = s().deliveries.find((d) => d.shopId === shopA && d.date === '2026-08-05')!;
expectThrow('改送货单价不写说明被拒绝', () =>
  s().updateDelivery(dA1.id, { date: dA1.date, lines: [{ styleId: hat, colorId: oat, qty: 6, unitPrice: 90 }] }), '改价说明');
s().updateDelivery(dA1.id, { date: dA1.date, lines: [{ styleId: hat, colorId: oat, qty: 6, unitPrice: 90 }] }, '换季促销');
check('写了说明后改价成功并留档', s().adjustments.some((a) => a.kind === 'delivery' && a.oldPrice === 100 && a.newPrice === 90 && a.reason === '换季促销'));
expectThrow('成交价异于约定价不写说明被拒绝', () =>
  s().addSale({ shopId: shopA, date: '2026-08-25', styleId: hat, colorId: oat, qty: 1, unitPrice: 80 }), '改价说明');
s().addSale({ shopId: shopA, date: '2026-08-25', styleId: hat, colorId: oat, qty: 1, unitPrice: 80 }, '微疵特价');
check('成交改价留档', s().adjustments.some((a) => a.kind === 'sale' && a.newPrice === 80 && a.reason === '微疵特价'));
// 库存：A 期末原本 4，又卖 1 件 → 3
const saA3 = buildSettlement(s(), shopA, '2026-08');
check('A 卖出 5 件、销售额 4×100+1×80=480', saA3.lines[0].sold === 5 && saA3.lines[0].soldAmount === 480);

console.log('\n[6] 结账后该批记录锁定，不许再改');
s().confirmSettlement(shopA, '2026-08', '差 1 件待店家找货，先结');
expectThrow('已结账月份不能补售出', () =>
  s().addSale({ shopId: shopA, date: '2026-08-28', styleId: hat, colorId: oat, qty: 1, unitPrice: 90 }, 'x'), '已结账');
expectThrow('已结账月份不能补送货', () =>
  s().addDelivery({ shopId: shopA, date: '2026-08-28', lines: [{ styleId: hat, colorId: oat, qty: 1, unitPrice: 90 }] }), '已结账');
expectThrow('已结账月份不能退货', () =>
  s().addReturn({ shopId: shopA, date: '2026-08-28', styleId: hat, colorId: oat, qty: 1 }), '已结账');
expectThrow('已结账单不能改送货价', () =>
  s().updateDelivery(dA1.id, { date: dA1.date, lines: [{ styleId: hat, colorId: oat, qty: 6, unitPrice: 95 }] }, '再改'), '已结账');
expectThrow('已结账月不能删除售出', () => {
    const sale = s().sales.find((x) => x.shopId === shopA && x.date === '2026-08-25')!;
    s().deleteSale(sale.id);
  }, '已结账');
const confirmed = s().settlements.find((x) => x.shopId === shopA && x.period === '2026-08')!;
check('对账单为已确认状态', confirmed.status === 'confirmed');
check('改价说明已钉到对账单', s().adjustments.filter((a) => a.settlementId === confirmed.id).length === 2);
const totals = settlementTotals(confirmed.lines);
check('结账汇总：我方应得 = 480×0.7 = 336', totals.makerAmount === 336, `实际 ${totals.makerAmount}`);

console.log('\n[7] 只锁对应店铺与月份；B 店 8 月未结账，单据仍可动（但受库存约束）');
expectThrow('B 店无在店库存时不能卖', () =>
  s().addSale({ shopId: shopB, date: '2026-08-28', styleId: hat, colorId: oat, qty: 1, unitPrice: 100 }), '在店库存只有 0');

console.log('\n[8] 月结连续性：结了晚的月份不能倒回去结早的月份');
// 给 A 店 9 月造一笔并结账
s().addProduce({ date: '2026-09-02', styleId: hat, colorId: oat, qty: 3 });
s().addDelivery({ shopId: shopA, date: '2026-09-03', lines: [{ styleId: hat, colorId: oat, qty: 3, unitPrice: 90 }] });
s().confirmSettlement(shopA, '2026-09');
expectThrow('9 月已结，不允许倒结更早月份（虚构 7 月草稿）', () => s().confirmSettlement(shopA, '2026-07'), '更晚月份');

console.log('\n[9] 跨月期初结转');
// A 店 8 月末账面期末 3（送 8 卖 5），9 月又送 3 卖 0 → 9 月对账单 opening 应为 3
const sep = buildSettlement(s(), shopA, '2026-09');
const sepLine = sep.lines.find((l) => l.styleId === hat && l.colorId === oat)!;
check('9 月期初 = 8 月期末 = 3', sepLine.opening === 3, `实际 ${sepLine.opening}`);
check('9 月期末 = 6', sepLine.ending === 6, `实际 ${sepLine.ending}`);

console.log(`\n结果：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
