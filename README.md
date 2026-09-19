# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## 成品寄售对账（`#/consignment`）

织好的成品放小店寄售时，用这个模块按月按店对账。首页点「🧶 成品寄售对账」进入，数据通过 zustand persist 存在浏览器 localStorage（键 `knitting-consignment-storage`），离线可用。

页面与流程：

1. **小店**：登记店名、联系人、默认我方分成比例。
2. **款式 · 库存**：款式 + 颜色即一种成品（同款不同色、送不同店均分开算）；织好先「入库」；改价必须填写一次说明，并留有改价历史。
3. **送货登记**：一批可含多款，逐行记件数 / 约定售价 / 分成；件数不能超过手上可用库存（入库 − 各店在店）。
4. **退货登记**：记对方实际退回到手的件，不能超过店里现存；退回件自动回到手上库存，可再送到另一家店。
5. **月度对账**：按店按月开账单，录入对方报来的「卖出 / 退货 / 月底店存」，系统按 `期初 + 送 − 退` 逐款核对：
   - 报数三项之和对不上 → 流水差异；对方报退与我方实收不一致 → 退货差异；差异逐行写明差几件、差在哪。
   - 有差异时必须填写处理说明才能结账。
   - 确认结账后相关送货/退货批次锁定不可再改；期末店存结转为下月期初；账期必须顺序往后开。
   - 账单内可临时改结算价/分成（改价仍需说明，且不改动原始送货单）。

空数据时可用「载入演示数据」体验完整流程。
