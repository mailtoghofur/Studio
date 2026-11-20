// Klien Google Sheets API v4 untuk membuat, menghubungkan, membaca, dan memperbarui data Terapis, Layanan, dan Reservasi.

import {
  DEFAULT_SERVICES,
  DEFAULT_THERAPISTS,
  SHEET_HEADERS,
  SHEET_TABS,
} from '../config';
import type {
  Booking,
  BookingStatus,
  LocationType,
  Service,
  ServiceCategory,
  SpreadsheetConnection,
  Therapist,
} from './types';

export class AuthExpiredError extends Error {
  constructor(message = 'Sesi izin Google Sheets berakhir. Silakan masuk kembali.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export class SheetsApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
  }
}

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export function extractSpreadsheetId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage =
      data?.error?.message || `Permintaan Google Sheets gagal (${response.status}).`;
    throw new SheetsApiError(apiMessage, response.status);
  }

  return data as T;
}

function therapistToRow(t: Therapist): (string | boolean)[] {
  return [t.therapist_id, t.name, t.is_active ? 'TRUE' : 'FALSE'];
}

function serviceToRow(s: Service): (string | number | boolean)[] {
  return [
    s.service_id,
    s.category,
    s.service_name,
    s.duration_minutes,
    s.price,
    s.allow_home_service ? 'TRUE' : 'FALSE',
  ];
}

function bookingToRow(b: Booking): string[] {
  return [
    b.booking_id,
    b.patient_name,
    b.patient_phone,
    b.service_id,
    b.therapist_id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.location_type,
    b.patient_address,
    b.notes,
    b.status,
    b.created_at,
    b.updated_at,
  ];
}

function parseBool(val: unknown, fallback = true): boolean {
  if (typeof val === 'boolean') return val;
  const str = String(val ?? '').trim().toUpperCase();
  if (str === 'FALSE' || str === '0' || str === 'TIDAK' || str === 'NO') return false;
  if (str === 'TRUE' || str === '1' || str === 'YA' || str === 'YES') return true;
  return fallback;
}

function parseTherapists(rows: unknown[][] | undefined): Therapist[] {
  if (!rows || rows.length <= 1) return [];
  const parsed: Therapist[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row?.[0] ?? '').trim();
    const name = String(row?.[1] ?? '').trim();
    if (!id && !name) continue;
    parsed.push({
      therapist_id: id || `T-${String(parsed.length + 1).padStart(2, '0')}`,
      name: name || `Terapis ${parsed.length + 1}`,
      is_active: parseBool(row?.[2], true),
    });
  }
  return parsed;
}

function parseServices(rows: unknown[][] | undefined): Service[] {
  if (!rows || rows.length <= 1) return [];
  const parsed: Service[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row?.[0] ?? '').trim();
    const rawCat = String(row?.[1] ?? '').trim().toUpperCase();
    const name = String(row?.[2] ?? '').trim();
    if (!id || !name) continue;
    const category: ServiceCategory = rawCat === 'FACIAL' ? 'FACIAL' : 'PIJAT';
    const duration = Math.max(15, Number(row?.[3]) || 60);
    const price = Math.max(0, Math.round(Number(row?.[4]) || 0));
    parsed.push({
      service_id: id,
      category,
      service_name: name,
      duration_minutes: duration,
      price,
      allow_home_service: category === 'PIJAT',
    });
  }
  return parsed;
}

function parseBookings(rows: unknown[][] | undefined): Booking[] {
  if (!rows || rows.length <= 1) return [];
  const parsed: Booking[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row?.[0] ?? '').trim();
    const patientName = String(row?.[1] ?? '').trim();
    if (!id || !patientName) continue;
    const rawLoc = String(row?.[8] ?? '').trim().toUpperCase();
    const locationType: LocationType = rawLoc === 'HOME_SERVICE' ? 'HOME_SERVICE' : 'CLINIC';
    const rawStatus = String(row?.[11] ?? '').trim().toUpperCase();
    let status: BookingStatus = 'SCHEDULED';
    if (rawStatus === 'COMPLETED') status = 'COMPLETED';
    else if (rawStatus === 'CANCELLED') status = 'CANCELLED';

    parsed.push({
      booking_id: id,
      patient_name: patientName,
      patient_phone: String(row?.[2] ?? '').trim(),
      service_id: String(row?.[3] ?? '').trim(),
      therapist_id: String(row?.[4] ?? '').trim(),
      booking_date: String(row?.[5] ?? '').trim(),
      start_time: String(row?.[6] ?? '').trim(),
      end_time: String(row?.[7] ?? '').trim(),
      location_type: locationType,
      patient_address: String(row?.[9] ?? '').trim(),
      notes: String(row?.[10] ?? '').trim(),
      status,
      created_at: String(row?.[12] ?? '').trim(),
      updated_at: String(row?.[13] ?? '').trim(),
    });
  }
  return parsed;
}

interface SpreadsheetMetadataResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: { title: string };
  sheets?: Array<{ properties?: { sheetId: number; title: string } }>;
}

export async function createClinicSpreadsheet(
  accessToken: string,
  title = 'Database Penjadwalan Naomi Beauty & Wellness'
): Promise<SpreadsheetConnection> {
  const created = await sheetsFetch<SpreadsheetMetadataResponse>(SHEETS_BASE_URL, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title, locale: 'id_ID' },
      sheets: [
        { properties: { title: SHEET_TABS.therapists } },
        { properties: { title: SHEET_TABS.services } },
        { properties: { title: SHEET_TABS.bookings } },
      ],
    }),
  });

  await sheetsFetch(
    `${SHEETS_BASE_URL}/${created.spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          {
            range: `'${SHEET_TABS.therapists}'!A1:C4`,
            values: [
              [...SHEET_HEADERS.therapists],
              ...DEFAULT_THERAPISTS.map(therapistToRow),
            ],
          },
          {
            range: `'${SHEET_TABS.services}'!A1:F${DEFAULT_SERVICES.length + 1}`,
            values: [
              [...SHEET_HEADERS.services],
              ...DEFAULT_SERVICES.map(serviceToRow),
            ],
          },
          {
            range: `'${SHEET_TABS.bookings}'!A1:N1`,
            values: [[...SHEET_HEADERS.bookings]],
          },
        ],
      }),
    }
  );

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties.title,
    spreadsheetUrl: created.spreadsheetUrl,
  };
}

export async function connectExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetConnection> {
  const meta = await sheetsFetch<SpreadsheetMetadataResponse>(
    `${SHEETS_BASE_URL}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    accessToken
  );

  const existingTitles = new Set(
    (meta.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[]
  );

  const missingTabs = [
    SHEET_TABS.therapists,
    SHEET_TABS.services,
    SHEET_TABS.bookings,
  ].filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    await sheetsFetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: { properties: { title } },
        })),
      }),
    });

    const seedData: Array<{ range: string; values: (string | number | boolean)[][] }> = [];
    if (missingTabs.includes(SHEET_TABS.therapists)) {
      seedData.push({
        range: `'${SHEET_TABS.therapists}'!A1:C4`,
        values: [[...SHEET_HEADERS.therapists], ...DEFAULT_THERAPISTS.map(therapistToRow)],
      });
    }
    if (missingTabs.includes(SHEET_TABS.services)) {
      seedData.push({
        range: `'${SHEET_TABS.services}'!A1:F${DEFAULT_SERVICES.length + 1}`,
        values: [[...SHEET_HEADERS.services], ...DEFAULT_SERVICES.map(serviceToRow)],
      });
    }
    if (missingTabs.includes(SHEET_TABS.bookings)) {
      seedData.push({
        range: `'${SHEET_TABS.bookings}'!A1:N1`,
        values: [[...SHEET_HEADERS.bookings]],
      });
    }

    if (seedData.length > 0) {
      await sheetsFetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values:batchUpdate`, accessToken, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: seedData,
        }),
      });
    }
  }

  return {
    spreadsheetId: meta.spreadsheetId,
    title: meta.properties.title,
    spreadsheetUrl: meta.spreadsheetUrl,
  };
}

interface BatchGetResponse {
  valueRanges: Array<{
    range: string;
    values?: unknown[][];
  }>;
}

export async function loadClinicData(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  therapists: Therapist[];
  services: Service[];
  bookings: Booking[];
}> {
  const ranges = [
    encodeURIComponent(`'${SHEET_TABS.therapists}'!A1:C100`),
    encodeURIComponent(`'${SHEET_TABS.services}'!A1:F300`),
    encodeURIComponent(`'${SHEET_TABS.bookings}'!A1:N3000`),
  ];
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}`;
  const res = await sheetsFetch<BatchGetResponse>(url, accessToken);

  const therapists = parseTherapists(res.valueRanges?.[0]?.values);
  const services = parseServices(res.valueRanges?.[1]?.values);
  const bookings = parseBookings(res.valueRanges?.[2]?.values);

  return {
    therapists: therapists.length > 0 ? therapists : DEFAULT_THERAPISTS,
    services,
    bookings,
  };
}

async function findRowNumberById(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  id: string
): Promise<number | null> {
  const range = encodeURIComponent(`'${tabName}'!A1:A3000`);
  const res = await sheetsFetch<{ values?: unknown[][] }>(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}`,
    accessToken
  );
  const rows = res.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? '').trim() === id) {
      return i + 1;
    }
  }
  return null;
}

export async function appendBookingToSheet(
  accessToken: string,
  spreadsheetId: string,
  booking: Booking
): Promise<void> {
  const range = encodeURIComponent(`'${SHEET_TABS.bookings}'!A:N`);
  await sheetsFetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [bookingToRow(booking)],
      }),
    }
  );
}

export async function updateBookingInSheet(
  accessToken: string,
  spreadsheetId: string,
  booking: Booking
): Promise<void> {
  const rowNumber = await findRowNumberById(
    accessToken,
    spreadsheetId,
    SHEET_TABS.bookings,
    booking.booking_id
  );
  if (!rowNumber) {
    await appendBookingToSheet(accessToken, spreadsheetId, booking);
    return;
  }
  const range = encodeURIComponent(`'${SHEET_TABS.bookings}'!A${rowNumber}:N${rowNumber}`);
  await sheetsFetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [bookingToRow(booking)],
      }),
    }
  );
}

export async function appendServiceToSheet(
  accessToken: string,
  spreadsheetId: string,
  service: Service
): Promise<void> {
  const range = encodeURIComponent(`'${SHEET_TABS.services}'!A:F`);
  await sheetsFetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [serviceToRow(service)],
      }),
    }
  );
}

export async function updateServiceInSheet(
  accessToken: string,
  spreadsheetId: string,
  service: Service
): Promise<void> {
  const rowNumber = await findRowNumberById(
    accessToken,
    spreadsheetId,
    SHEET_TABS.services,
    service.service_id
  );
  if (!rowNumber) {
    await appendServiceToSheet(accessToken, spreadsheetId, service);
    return;
  }
  const range = encodeURIComponent(`'${SHEET_TABS.services}'!A${rowNumber}:F${rowNumber}`);
  await sheetsFetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [serviceToRow(service)],
      }),
    }
  );
}

export async function saveTherapistsToSheet(
  accessToken: string,
  spreadsheetId: string,
  therapists: Therapist[]
): Promise<void> {
  const range = encodeURIComponent(`'${SHEET_TABS.therapists}'!A1:C${therapists.length + 1}`);
  await sheetsFetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[...SHEET_HEADERS.therapists], ...therapists.map(therapistToRow)],
      }),
    }
  );
}
