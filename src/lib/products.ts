// Logika katalog produk dan pencatatan penjualan produk oleh terapis beserta perhitungan komisi 10% (FT-02 & FT-08).

import { THERAPIST_COMMISSION_RATE } from '../config';
import { parseDateParts } from './format';
import type { Product, ProductSale, Therapist } from './types';

export interface ProductSaleFormInput {
  product_id: string;
  therapist_id: string;
  buyer_name: string;
  quantity: string;
  unit_price: string;
  sale_date: string;
  notes: string;
}

export type ProductSaleFieldName = keyof ProductSaleFormInput;

export type ProductSaleErrors = Partial<Record<ProductSaleFieldName, string>>;

export interface ProductSaleValidationResult {
  valid: boolean;
  errors: ProductSaleErrors;
  sale?: ProductSale;
  commission: number;
}

export function calculateProductSaleCommission(totalAmount: number): number {
  const safe = Number.isFinite(totalAmount) ? Math.max(0, Math.round(totalAmount)) : 0;
  return Math.round(safe * THERAPIST_COMMISSION_RATE);
}

export function validateAndCreateProductSale(params: {
  input: ProductSaleFormInput;
  products: Product[];
  therapists: Therapist[];
  nowIso?: string;
}): ProductSaleValidationResult {
  const { input, products, therapists, nowIso = new Date().toISOString() } = params;
  const errors: ProductSaleErrors = {};

  const product = products.find((p) => p.product_id === input.product_id);
  if (!product) {
    errors.product_id = 'Pilih salah satu produk yang dijual dari katalog.';
  }

  const therapist = therapists.find((t) => t.therapist_id === input.therapist_id);
  if (!therapist) {
    errors.therapist_id = 'Pilih terapis yang menjual produk ini.';
  } else if (!therapist.is_active) {
    errors.therapist_id = `Terapis ${therapist.name} sedang nonaktif. Pilih terapis aktif.`;
  }

  const qtyText = input.quantity.trim();
  const parsedQty = /^\d+$/.test(qtyText) ? Number(qtyText) : NaN;
  if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 100) {
    errors.quantity = 'Masukkan jumlah produk bulat antara 1 sampai 100, contoh: 2.';
  }

  const priceText = input.unit_price.trim();
  const parsedPrice = /^\d+$/.test(priceText) ? Number(priceText) : NaN;
  if (!Number.isSafeInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > 100_000_000) {
    errors.unit_price = 'Masukkan harga satuan bulat tanpa titik/koma, contoh: 85000.';
  }

  if (!parseDateParts(input.sale_date)) {
    errors.sale_date = 'Pilih tanggal penjualan yang valid, contoh: 2026-11-21.';
  }

  if (Object.keys(errors).length > 0 || !product || !therapist) {
    return { valid: false, errors, commission: 0 };
  }

  const totalAmount = Math.round(parsedQty * parsedPrice);
  const commission = calculateProductSaleCommission(totalAmount);
  const saleId = `SL-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

  return {
    valid: true,
    errors: {},
    commission,
    sale: {
      sale_id: saleId,
      product_id: product.product_id,
      product_name: product.product_name,
      therapist_id: therapist.therapist_id,
      buyer_name: input.buyer_name.trim(),
      quantity: parsedQty,
      unit_price: Math.round(parsedPrice),
      total_amount: totalAmount,
      sale_date: input.sale_date,
      notes: input.notes.trim(),
      status: 'COMPLETED',
      created_at: nowIso,
      updated_at: nowIso,
    },
  };
}

export interface ProductSalesSummary {
  transactionCount: number;
  unitCount: number;
  totalRevenue: number;
  totalCommission: number;
}

export function calculateProductSalesSummary(sales: ProductSale[]): ProductSalesSummary {
  let transactionCount = 0;
  let unitCount = 0;
  let totalRevenue = 0;
  let totalCommission = 0;

  for (const sale of sales) {
    if (sale.status === 'CANCELLED') continue;
    const amount = Math.max(0, Math.round(sale.total_amount));
    transactionCount += 1;
    unitCount += Math.max(0, Math.round(sale.quantity));
    totalRevenue += amount;
    totalCommission += calculateProductSaleCommission(amount);
  }

  return {
    transactionCount,
    unitCount,
    totalRevenue,
    totalCommission,
  };
}
