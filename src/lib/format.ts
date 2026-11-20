// Fungsi pemformatan Rupiah, jam, tanggal Indonesia, dan normalisasi nomor telepon Indonesia.

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatRupiah(amount: number): string {
  const safeInt = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rp${String(safeInt).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formatTimeDisplay(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return hhmm;
  return hhmm.replace(':', '.');
}

export function formatTimeRange(startHHMM: string, endHHMM: string): string {
  return `${formatTimeDisplay(startHHMM)}–${formatTimeDisplay(endHHMM)}`;
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatDateIndo(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  return `${parts.day} ${BULAN_INDO[parts.month - 1]} ${parts.year}`;
}

export function formatWeekdayDateIndo(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const dateObj = new Date(parts.year, parts.month - 1, parts.day);
  const hari = HARI_INDO[dateObj.getDay()];
  return `${hari}, ${parts.day} ${BULAN_INDO[parts.month - 1]} ${parts.year}`;
}

export function getTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYYYYMMDD(dateStr: string, deltaDays: number): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return getTodayYYYYMMDD();
  const dateObj = new Date(parts.year, parts.month - 1, parts.day + deltaDays);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Menerima format 08xxx, +62xxx, atau 62xxx (dengan spasi/tanda hubung) dan mengembalikan 62xxx angka saja.
 * Mengembalikan null bila tidak valid.
 */
export function normalizeIndoPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-().]/g, '');

  let digits = '';
  if (cleaned.startsWith('+62')) {
    digits = '62' + cleaned.slice(3);
  } else if (cleaned.startsWith('62')) {
    digits = cleaned;
  } else if (cleaned.startsWith('0')) {
    digits = '62' + cleaned.slice(1);
  } else {
    return null;
  }

  if (!/^\d+$/.test(digits)) return null;
  // Panjang nomor telepon Indonesia setelah 62 umumnya 9-13 digit (total 11-15 digit, minimal 10)
  if (digits.length < 10 || digits.length > 15) return null;
  // Pastikan tidak diawali 620
  if (digits.startsWith('620')) return null;
  return digits;
}

export function formatPhoneDisplay(phone62: string): string {
  const digits = phone62.replace(/\D/g, '');
  if (!digits) return phone62;
  if (digits.startsWith('62')) {
    const rest = digits.slice(2);
    if (rest.length >= 9) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    return `+62 ${rest}`;
  }
  return phone62;
}
