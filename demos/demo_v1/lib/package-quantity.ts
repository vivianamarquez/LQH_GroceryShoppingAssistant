import type { GroceryItem } from '@/lib/grocery';

type Kind = 'count' | 'weight' | 'volume';
type Unit = { kind: Kind; multiplier: number; label: string };

export type PackagePlan = {
  cartQuantity: number;
  packageQuantity?: number;
  packageUnit?: string;
  needsReview?: boolean;
};

function unit(value: string): Unit | undefined {
  const name = value.toLowerCase().replaceAll('.', '').trim();
  if (['each', 'ea', 'count', 'counts', 'ct'].includes(name))
    return { kind: 'count', multiplier: 1, label: 'ct' };
  if (['dozen', 'dozens'].includes(name))
    return { kind: 'count', multiplier: 12, label: 'ct' };
  if (['oz', 'ounce', 'ounces'].includes(name))
    return { kind: 'weight', multiplier: 1, label: 'oz' };
  if (['lb', 'lbs', 'pound', 'pounds'].includes(name))
    return { kind: 'weight', multiplier: 16, label: 'lb' };
  if (['fl oz', 'fluid ounce', 'fluid ounces'].includes(name))
    return { kind: 'volume', multiplier: 1, label: 'fl oz' };
  if (['gal', 'gallon', 'gallons'].includes(name))
    return { kind: 'volume', multiplier: 128, label: 'gal' };
  if (['qt', 'quart', 'quarts'].includes(name))
    return { kind: 'volume', multiplier: 32, label: 'qt' };
  if (['pt', 'pint', 'pints'].includes(name))
    return { kind: 'volume', multiplier: 16, label: 'pt' };
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(name))
    return { kind: 'volume', multiplier: 33.814, label: 'L' };
}

function packageMeasure(size: string | undefined, kind: Kind) {
  if (!size) return;
  const pattern = /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid ounces?|gallons?|gal|quarts?|qt|pints?|pt|ounces?|oz|pounds?|lbs?|lb|counts?|ct)\b/i;
  const match = size.match(pattern);
  if (!match) return;
  const parsed = unit(match[2]);
  if (!parsed || parsed.kind !== kind) return;
  return {
    value: Number(match[1]),
    baseValue: Number(match[1]) * parsed.multiplier,
    label: parsed.label,
  };
}

export function packagePlan(item: GroceryItem, size?: string): PackagePlan {
  const measurement = item.line_item_measurements;
  const fallback = Math.max(1, Math.ceil(measurement?.quantity ?? 1));
  if (!measurement) return { cartQuantity: fallback };

  const requestedUnit = unit(measurement.unit);
  if (!requestedUnit) return { cartQuantity: fallback };
  const multiplier =
    requestedUnit.multiplier === 12 && measurement.quantity >= 12
      ? 1
      : requestedUnit.multiplier;
  const requested = measurement.quantity * multiplier;
  const available = packageMeasure(size, requestedUnit.kind);
  if (!available) return { cartQuantity: 1, needsReview: true };

  return {
    cartQuantity: Math.max(1, Math.ceil(requested / available.baseValue)),
    packageQuantity: available.value,
    packageUnit: available.label,
  };
}
