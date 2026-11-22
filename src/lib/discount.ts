// Perhitungan pilihan diskon 0%, 10%, dan 20% saat proses penyelesaian treatment (FT-05).

import { TREATMENT_DISCOUNT_LABELS } from '../config';
import type { TreatmentDiscountPercent } from './types';

export interface TreatmentDiscountCalculation {
  basePrice: number;
  discountPercent: TreatmentDiscountPercent;
  discountAmount: number;
  finalPrice: number;
}

export function normalizeTreatmentDiscountPercent(value: unknown): TreatmentDiscountPercent {
  if (value === 10 || value === '10') return 10;
  if (value === 20 || value === '20') return 20;
  return 0;
}

export function calculateTreatmentDiscount(params: {
  basePrice: number;
  discountPercent: TreatmentDiscountPercent;
  isLoyaltyReward?: boolean;
}): TreatmentDiscountCalculation {
  const { basePrice, discountPercent, isLoyaltyReward = false } = params;
  if (isLoyaltyReward) {
    return {
      basePrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalPrice: 0,
    };
  }

  const safeBase = Number.isFinite(basePrice) ? Math.max(0, Math.round(basePrice)) : 0;
  const safePercent = normalizeTreatmentDiscountPercent(discountPercent);
  const discountAmount = Math.round(safeBase * (safePercent / 100));
  const finalPrice = Math.max(0, safeBase - discountAmount);

  return {
    basePrice: safeBase,
    discountPercent: safePercent,
    discountAmount,
    finalPrice,
  };
}

export function getTreatmentDiscountLabel(discountPercent?: TreatmentDiscountPercent): string {
  return TREATMENT_DISCOUNT_LABELS[normalizeTreatmentDiscountPercent(discountPercent)];
}
