/** The size that fits a name on the scroll's curve, which cuts off whatever runs past its ends. */
export function scrollFontSize(name: string): number {
  return Math.min(15, Math.round((162 / Math.max(1, [...name].length)) * 10) / 10);
}
