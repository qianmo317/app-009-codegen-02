import { useConsignmentStore } from '../../store/consignmentStore';

/** 店铺/款式/颜色的名称查找 */
export function useConsignNames() {
  const shops = useConsignmentStore((s) => s.shops);
  const styles = useConsignmentStore((s) => s.styles);
  const colors = useConsignmentStore((s) => s.colors);
  const shopName = (id: string) => shops.find((x) => x.id === id)?.name ?? '（已删除店铺）';
  const styleName = (id: string) => styles.find((x) => x.id === id)?.name ?? '（已删除款式）';
  const colorName = (id: string) => colors.find((x) => x.id === id)?.name ?? '（已删除颜色）';
  return { shops, styles, colors, shopName, styleName, colorName };
}

export function skuName(
  styleName: (id: string) => string,
  colorName: (id: string) => string,
  styleId: string,
  colorId: string,
) {
  return `${styleName(styleId)} / ${colorName(colorId)}`;
}
