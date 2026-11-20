// Logika sistem kesetiaan pelanggan: setiap 10 pemesanan Pijat atau Facial berhak gratis 1x paket standar (FT-09).

import { LOYALTY_MILESTONE_COUNT } from '../config';
import { normalizeIndoPhone } from './format';
import type { Booking, Service, ServiceCategory } from './types';

export interface CustomerLoyaltySummary {
  customer_phone: string;
  customer_name: string;
  paid_bookings_count: number;
  pijat_count: number;
  facial_count: number;
  completed_count: number;
  scheduled_count: number;
  redeemed_rewards_count: number;
  earned_rewards_count: number;
  available_rewards_count: number;
  cycle_progress: number;
  remaining_to_next_reward: number;
  last_booking_date: string;
}

export interface LoyaltyOverview {
  customers: CustomerLoyaltySummary[];
  totalCustomers: number;
  eligibleCustomersCount: number;
  totalAvailableRewards: number;
  totalRedeemedRewards: number;
  standardServices: Partial<Record<ServiceCategory, Service>>;
}

function getCanonicalCustomerPhone(rawPhone: string): string {
  return normalizeIndoPhone(rawPhone) ?? rawPhone.replace(/\D/g, '');
}

/**
 * Mengambil paket standar untuk masing-masing kategori (harga terendah, lalu durasi terpendek).
 */
export function getStandardRewardServices(
  services: Service[]
): Partial<Record<ServiceCategory, Service>> {
  const result: Partial<Record<ServiceCategory, Service>> = {};

  for (const category of ['PIJAT', 'FACIAL'] as const) {
    const candidates = services
      .filter((s) => s.category === category)
      .slice()
      .sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        if (a.duration_minutes !== b.duration_minutes) {
          return a.duration_minutes - b.duration_minutes;
        }
        return a.service_id.localeCompare(b.service_id);
      });
    if (candidates[0]) {
      result[category] = candidates[0];
    }
  }

  return result;
}

export function isStandardRewardService(serviceId: string, services: Service[]): boolean {
  const std = getStandardRewardServices(services);
  return (
    std.PIJAT?.service_id === serviceId || std.FACIAL?.service_id === serviceId
  );
}

export function calculateCustomerLoyalty(
  bookings: Booking[],
  services: Service[]
): LoyaltyOverview {
  const serviceMap = new Map(services.map((s) => [s.service_id, s]));
  const standardServices = getStandardRewardServices(services);

  const grouped = new Map<
    string,
    {
      customer_phone: string;
      customer_name: string;
      last_sort_key: string;
      last_booking_date: string;
      paid_bookings_count: number;
      pijat_count: number;
      facial_count: number;
      completed_count: number;
      scheduled_count: number;
      redeemed_rewards_count: number;
    }
  >();

  for (const booking of bookings) {
    if (booking.status === 'CANCELLED') continue;

    const phoneKey = getCanonicalCustomerPhone(booking.patient_phone);
    if (!phoneKey) continue;

    const sortKey = `${booking.booking_date} ${booking.start_time} ${booking.created_at}`;
    const service = serviceMap.get(booking.service_id);

    let entry = grouped.get(phoneKey);
    if (!entry) {
      entry = {
        customer_phone: phoneKey,
        customer_name: booking.patient_name,
        last_sort_key: sortKey,
        last_booking_date: booking.booking_date,
        paid_bookings_count: 0,
        pijat_count: 0,
        facial_count: 0,
        completed_count: 0,
        scheduled_count: 0,
        redeemed_rewards_count: 0,
      };
      grouped.set(phoneKey, entry);
    } else if (sortKey >= entry.last_sort_key) {
      entry.customer_name = booking.patient_name;
      entry.last_sort_key = sortKey;
      entry.last_booking_date = booking.booking_date;
    }

    if (booking.is_loyalty_reward) {
      entry.redeemed_rewards_count += 1;
      continue;
    }

    entry.paid_bookings_count += 1;
    if (booking.status === 'COMPLETED') entry.completed_count += 1;
    else if (booking.status === 'SCHEDULED') entry.scheduled_count += 1;

    if (service?.category === 'PIJAT') entry.pijat_count += 1;
    else if (service?.category === 'FACIAL') entry.facial_count += 1;
  }

  const customers: CustomerLoyaltySummary[] = Array.from(grouped.values())
    .map((entry) => {
      const earned = Math.floor(entry.paid_bookings_count / LOYALTY_MILESTONE_COUNT);
      const available = Math.max(0, earned - entry.redeemed_rewards_count);
      const cycleProgress = entry.paid_bookings_count % LOYALTY_MILESTONE_COUNT;
      const remaining = LOYALTY_MILESTONE_COUNT - cycleProgress;

      return {
        customer_phone: entry.customer_phone,
        customer_name: entry.customer_name,
        paid_bookings_count: entry.paid_bookings_count,
        pijat_count: entry.pijat_count,
        facial_count: entry.facial_count,
        completed_count: entry.completed_count,
        scheduled_count: entry.scheduled_count,
        redeemed_rewards_count: entry.redeemed_rewards_count,
        earned_rewards_count: earned,
        available_rewards_count: available,
        cycle_progress: cycleProgress,
        remaining_to_next_reward: remaining,
        last_booking_date: entry.last_booking_date,
      };
    })
    .sort((a, b) => {
      if (b.available_rewards_count !== a.available_rewards_count) {
        return b.available_rewards_count - a.available_rewards_count;
      }
      if (b.paid_bookings_count !== a.paid_bookings_count) {
        return b.paid_bookings_count - a.paid_bookings_count;
      }
      return a.customer_name.localeCompare(b.customer_name, 'id');
    });

  let eligibleCustomersCount = 0;
  let totalAvailableRewards = 0;
  let totalRedeemedRewards = 0;

  for (const c of customers) {
    if (c.available_rewards_count > 0) eligibleCustomersCount += 1;
    totalAvailableRewards += c.available_rewards_count;
    totalRedeemedRewards += c.redeemed_rewards_count;
  }

  return {
    customers,
    totalCustomers: customers.length,
    eligibleCustomersCount,
    totalAvailableRewards,
    totalRedeemedRewards,
    standardServices,
  };
}

export function findCustomerLoyaltyByPhone(
  rawPhone: string,
  bookings: Booking[],
  services: Service[],
  excludeBookingId?: string
): CustomerLoyaltySummary | null {
  const normalized = normalizeIndoPhone(rawPhone);
  if (!normalized) return null;

  const filteredBookings = excludeBookingId
    ? bookings.filter((b) => b.booking_id !== excludeBookingId)
    : bookings;

  const overview = calculateCustomerLoyalty(filteredBookings, services);
  return overview.customers.find((c) => c.customer_phone === normalized) ?? null;
}
