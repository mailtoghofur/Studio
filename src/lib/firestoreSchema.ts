// Sanitasi dan validasi payload Firestore yang disinkronkan langsung dengan batasan di firebase-blueprint.json.

import blueprint from '../../firebase-blueprint.json';
import type {
  Booking,
  Product,
  ProductSale,
  Service,
  Therapist,
  TreatmentDiscountPercent,
} from './types';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const TIME_PATTERN = /^[0-9]{2}:[0-9]{2}$/;
const PHONE_PATTERN = /^[0-9+]+$/;

const SCHEMA_LIMITS = {
  workspaceIdMax: blueprint.entities.Workspace.properties.workspaceId.maxLength,
  clinicNameMax: blueprint.entities.Workspace.properties.clinicName.maxLength,
  ownerNameMax: blueprint.entities.Workspace.properties.ownerName.maxLength,
  ownerEmailMax: blueprint.entities.Workspace.properties.ownerEmail.maxLength,
  therapistIdMax: blueprint.entities.Therapist.properties.therapist_id.maxLength,
  therapistNameMax: blueprint.entities.Therapist.properties.name.maxLength,
  serviceIdMax: blueprint.entities.Service.properties.service_id.maxLength,
  serviceNameMax: blueprint.entities.Service.properties.service_name.maxLength,
  productIdMax: blueprint.entities.Product.properties.product_id.maxLength,
  productNameMax: blueprint.entities.Product.properties.product_name.maxLength,
  bookingIdMax: blueprint.entities.Booking.properties.booking_id.maxLength,
  patientNameMax: blueprint.entities.Booking.properties.patient_name.maxLength,
  patientPhoneMax: blueprint.entities.Booking.properties.patient_phone.maxLength,
  patientAddressMax: blueprint.entities.Booking.properties.patient_address.maxLength,
  bookingNotesMax: blueprint.entities.Booking.properties.notes.maxLength,
  revisionAtMax: blueprint.entities.Booking.properties.receipt_revised_at.maxLength,
  revisionReasonMax: blueprint.entities.Booking.properties.receipt_revision_reason.maxLength,
  saleIdMax: blueprint.entities.ProductSale.properties.sale_id.maxLength,
  buyerNameMax: blueprint.entities.ProductSale.properties.buyer_name.maxLength,
  saleNotesMax: blueprint.entities.ProductSale.properties.notes.maxLength,
  isoMax: blueprint.entities.Booking.properties.created_at_iso.maxLength,
} as const;

export function sanitizeEntityId(raw: string, maxLength = 64): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLength);
  return cleaned || `ID-${Date.now().toString(36).toUpperCase()}`;
}

export function clampString(raw: string | undefined | null, maxLength: number, fallback = ''): string {
  const trimmed = (raw ?? '').trim();
  const value = trimmed.length > 0 ? trimmed : fallback;
  return value.slice(0, maxLength);
}

export function sanitizePhone(raw: string | undefined | null): string {
  const digits = (raw ?? '').replace(/[^0-9+]/g, '').slice(0, SCHEMA_LIMITS.patientPhoneMax);
  if (digits.length >= 6 && PHONE_PATTERN.test(digits)) {
    return digits;
  }
  return '000000';
}

export function sanitizeDateYYYYMMDD(raw: string | undefined | null): string {
  const value = (raw ?? '').trim().slice(0, 10);
  if (DATE_PATTERN.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeTimeHHMM(raw: string | undefined | null, fallback = '10:00'): string {
  const value = (raw ?? '').trim().slice(0, 5);
  return TIME_PATTERN.test(value) ? value : fallback;
}

export function clampNumber(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) return min;
  return Math.min(max, Math.max(min, raw));
}

export function sanitizeDiscountPercent(raw: number | undefined): TreatmentDiscountPercent {
  if (raw === 10 || raw === 20) return raw;
  return 0;
}

export interface WorkspaceCreatePayload {
  workspaceId: string;
  ownerId: string;
  clinicName: string;
  ownerName: string;
  ownerEmail: string;
}

export function buildWorkspacePayload(params: {
  uid: string;
  clinicName: string;
  ownerName: string;
  ownerEmail: string;
}): WorkspaceCreatePayload {
  const safeUid = sanitizeEntityId(params.uid, SCHEMA_LIMITS.workspaceIdMax);
  return {
    workspaceId: safeUid,
    ownerId: safeUid,
    clinicName: clampString(params.clinicName, SCHEMA_LIMITS.clinicNameMax, 'Naomi Beauty & Wellness'),
    ownerName: clampString(params.ownerName, SCHEMA_LIMITS.ownerNameMax, 'Admin Klinik'),
    ownerEmail: clampString(params.ownerEmail, SCHEMA_LIMITS.ownerEmailMax, 'klinik@example.com'),
  };
}

export function buildTherapistPayload(
  workspaceId: string,
  ownerId: string,
  therapist: Therapist
) {
  return {
    therapist_id: sanitizeEntityId(therapist.therapist_id, SCHEMA_LIMITS.therapistIdMax),
    ownerId: sanitizeEntityId(ownerId, SCHEMA_LIMITS.workspaceIdMax),
    workspaceId: sanitizeEntityId(workspaceId, SCHEMA_LIMITS.workspaceIdMax),
    name: clampString(therapist.name, SCHEMA_LIMITS.therapistNameMax, 'Terapis'),
    is_active: Boolean(therapist.is_active),
  };
}

export function buildServicePayload(
  workspaceId: string,
  ownerId: string,
  service: Service
) {
  return {
    service_id: sanitizeEntityId(service.service_id, SCHEMA_LIMITS.serviceIdMax),
    ownerId: sanitizeEntityId(ownerId, SCHEMA_LIMITS.workspaceIdMax),
    workspaceId: sanitizeEntityId(workspaceId, SCHEMA_LIMITS.workspaceIdMax),
    category: service.category === 'FACIAL' ? ('FACIAL' as const) : ('PIJAT' as const),
    service_name: clampString(service.service_name, SCHEMA_LIMITS.serviceNameMax, 'Layanan Klinik'),
    duration_minutes: Math.round(clampNumber(service.duration_minutes, 15, 480)),
    price: Math.round(clampNumber(service.price, 0, 100000000)),
    allow_home_service: Boolean(service.allow_home_service),
  };
}

export function buildProductPayload(
  workspaceId: string,
  ownerId: string,
  product: Product
) {
  return {
    product_id: sanitizeEntityId(product.product_id, SCHEMA_LIMITS.productIdMax),
    ownerId: sanitizeEntityId(ownerId, SCHEMA_LIMITS.workspaceIdMax),
    workspaceId: sanitizeEntityId(workspaceId, SCHEMA_LIMITS.workspaceIdMax),
    product_name: clampString(product.product_name, SCHEMA_LIMITS.productNameMax, 'Produk Klinik'),
    price: Math.round(clampNumber(product.price, 0, 100000000)),
    is_active: Boolean(product.is_active),
  };
}

export function buildBookingPayload(
  workspaceId: string,
  ownerId: string,
  booking: Booking
) {
  const nowIso = new Date().toISOString().slice(0, SCHEMA_LIMITS.isoMax);
  return {
    booking_id: sanitizeEntityId(booking.booking_id, SCHEMA_LIMITS.bookingIdMax),
    ownerId: sanitizeEntityId(ownerId, SCHEMA_LIMITS.workspaceIdMax),
    workspaceId: sanitizeEntityId(workspaceId, SCHEMA_LIMITS.workspaceIdMax),
    patient_name: clampString(booking.patient_name, SCHEMA_LIMITS.patientNameMax, 'Pasien'),
    patient_phone: sanitizePhone(booking.patient_phone),
    service_id: sanitizeEntityId(booking.service_id, SCHEMA_LIMITS.serviceIdMax),
    therapist_id: sanitizeEntityId(booking.therapist_id, SCHEMA_LIMITS.therapistIdMax),
    booking_date: sanitizeDateYYYYMMDD(booking.booking_date),
    start_time: sanitizeTimeHHMM(booking.start_time, '10:00'),
    end_time: sanitizeTimeHHMM(booking.end_time, '11:00'),
    location_type: booking.location_type === 'HOME_SERVICE' ? ('HOME_SERVICE' as const) : ('CLINIC' as const),
    patient_address: clampString(booking.patient_address, SCHEMA_LIMITS.patientAddressMax, ''),
    notes: clampString(booking.notes, SCHEMA_LIMITS.bookingNotesMax, ''),
    status:
      booking.status === 'COMPLETED' || booking.status === 'CANCELLED'
        ? booking.status
        : ('SCHEDULED' as const),
    is_loyalty_reward: Boolean(booking.is_loyalty_reward),
    discount_percent: sanitizeDiscountPercent(booking.discount_percent),
    discount_amount: Math.round(clampNumber(booking.discount_amount ?? 0, 0, 100000000)),
    final_price: Math.round(clampNumber(booking.final_price ?? 0, 0, 100000000)),
    receipt_revised_at: clampString(booking.receipt_revised_at, SCHEMA_LIMITS.revisionAtMax, ''),
    receipt_revision_reason: clampString(
      booking.receipt_revision_reason,
      SCHEMA_LIMITS.revisionReasonMax,
      ''
    ),
    created_at_iso: clampString(booking.created_at, SCHEMA_LIMITS.isoMax, nowIso),
    updated_at_iso: clampString(booking.updated_at, SCHEMA_LIMITS.isoMax, nowIso),
  };
}

export function buildProductSalePayload(
  workspaceId: string,
  ownerId: string,
  sale: ProductSale
) {
  const nowIso = new Date().toISOString().slice(0, SCHEMA_LIMITS.isoMax);
  return {
    sale_id: sanitizeEntityId(sale.sale_id, SCHEMA_LIMITS.saleIdMax),
    ownerId: sanitizeEntityId(ownerId, SCHEMA_LIMITS.workspaceIdMax),
    workspaceId: sanitizeEntityId(workspaceId, SCHEMA_LIMITS.workspaceIdMax),
    product_id: sanitizeEntityId(sale.product_id, SCHEMA_LIMITS.productIdMax),
    product_name: clampString(sale.product_name, SCHEMA_LIMITS.productNameMax, 'Produk'),
    therapist_id: sanitizeEntityId(sale.therapist_id, SCHEMA_LIMITS.therapistIdMax),
    buyer_name: clampString(sale.buyer_name, SCHEMA_LIMITS.buyerNameMax, 'Pembeli'),
    quantity: Math.round(clampNumber(sale.quantity, 1, 1000)),
    unit_price: Math.round(clampNumber(sale.unit_price, 0, 100000000)),
    total_amount: Math.round(clampNumber(sale.total_amount, 0, 1000000000)),
    sale_date: sanitizeDateYYYYMMDD(sale.sale_date),
    notes: clampString(sale.notes, SCHEMA_LIMITS.saleNotesMax, ''),
    status: sale.status === 'CANCELLED' ? ('CANCELLED' as const) : ('COMPLETED' as const),
    created_at_iso: clampString(sale.created_at, SCHEMA_LIMITS.isoMax, nowIso),
    updated_at_iso: clampString(sale.updated_at, SCHEMA_LIMITS.isoMax, nowIso),
  };
}

export function isValidBlueprintId(id: string, maxLength = 128): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= maxLength && ID_PATTERN.test(id);
}
