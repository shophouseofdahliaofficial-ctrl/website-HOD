export const PRINT_PRICE_PER_POLAROID = 14;
export const PRINT_DELIVERY_FEE = 100;

export function calculatePrintOrderTotal(count: number): number {
  if (count <= 0) return 0;
  return PRINT_PRICE_PER_POLAROID * count + PRINT_DELIVERY_FEE;
}
