// Manajemen katalog layanan Pijat dan Facial (FT-02).

import { Edit3, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { CATEGORY_LABELS } from '../config';
import { formatRupiah } from '../lib/format';
import type { Service, ServiceCategory } from '../lib/types';

interface ServicesViewProps {
  services: Service[];
  onRequestSaveService: (mode: 'create' | 'edit', service: Service) => void;
}

export function ServicesView({ services, onRequestSaveService }: ServicesViewProps) {
  const [filterCat, setFilterCat] = useState<'ALL' | ServiceCategory>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [category, setCategory] = useState<ServiceCategory>('PIJAT');
  const [serviceName, setServiceName] = useState('');
  const [durationStr, setDurationStr] = useState('60');
  const [priceStr, setPriceStr] = useState('150000');
  const [errors, setErrors] = useState<{
    serviceName?: string;
    duration?: string;
    price?: string;
  }>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const filtered = services.filter((s) =>
    filterCat === 'ALL' ? true : s.category === filterCat
  );

  const openCreate = () => {
    setEditingService(null);
    setCategory('PIJAT');
    setServiceName('');
    setDurationStr('60');
    setPriceStr('150000');
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setCategory(service.category);
    setServiceName(service.service_name);
    setDurationStr(String(service.duration_minutes));
    setPriceStr(String(service.price));
    setErrors({});
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { serviceName?: string; duration?: string; price?: string } = {};
    const trimmedName = serviceName.trim();
    const parsedDuration = Number(durationStr.trim());
    const parsedPrice = Number(priceStr.trim());

    if (!trimmedName) {
      nextErrors.serviceName = 'Isi nama paket layanan, contoh: Pijat Relaksasi 60 Menit.';
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 360) {
      nextErrors.duration = 'Masukkan durasi bulat antara 15 sampai 360 menit, contoh: 60.';
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      nextErrors.price = 'Masukkan harga bulat minimal 0, contoh: 150000.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.serviceName) nameRef.current?.focus();
      else if (nextErrors.duration) durationRef.current?.focus();
      else if (nextErrors.price) priceRef.current?.focus();
      return;
    }

    const nextService: Service = {
      service_id:
        editingService?.service_id ??
        `S-${Date.now().toString(36).toUpperCase().slice(-4)}`,
      category,
      service_name: trimmedName,
      duration_minutes: parsedDuration,
      price: Math.round(parsedPrice),
      allow_home_service: category === 'PIJAT',
    };

    setModalOpen(false);
    onRequestSaveService(editingService ? 'edit' : 'create', nextService);
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Katalog Layanan Klinik
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Layanan Pijat mendukung klinik dan tempat pasien; Facial khusus di klinik.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Layanan</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div
          role="tablist"
          aria-label="Filter kategori layanan"
          className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 p-1"
        >
          {(
            [
              { key: 'ALL', label: 'Semua' },
              { key: 'PIJAT', label: 'Pijat' },
              { key: 'FACIAL', label: 'Facial' },
            ] as const
          ).map((tab) => {
            const active = filterCat === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterCat(tab.key)}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-neutral-600 tabular-nums">{filtered.length} paket layanan</p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-base font-medium text-neutral-900">Belum ada paket layanan</p>
          <p className="mt-1 text-sm text-neutral-600">
            Tambahkan layanan Pijat atau Facial untuk mulai menerima reservasi.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                <th className="px-4 py-3 font-semibold">Nama Layanan</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Lokasi Didukung</th>
                <th className="px-4 py-3 text-right font-semibold">Durasi</th>
                <th className="px-4 py-3 text-right font-semibold">Harga</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.map((s) => (
                <tr key={s.service_id} className="hover:bg-neutral-50/80">
                  <td className="px-4 py-3 font-medium text-neutral-900">{s.service_name}</td>
                  <td className="px-4 py-3 text-neutral-700">{CATEGORY_LABELS[s.category]}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {s.allow_home_service ? 'Di Klinik & Tempat Pasien' : 'Hanya Di Klinik'}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 tabular-nums">
                    {s.duration_minutes} menit
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                    {formatRupiah(s.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Ubah</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <h2 id="service-modal-title" className="text-lg font-semibold text-neutral-900">
                {editingService ? 'Ubah Paket Layanan' : 'Tambah Paket Layanan'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup form layanan"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <span className="block text-sm font-medium text-neutral-800">Kategori</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(['PIJAT', 'FACIAL'] as const).map((cat) => (
                    <label
                      key={cat}
                      className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 ${
                        category === cat
                          ? 'border-amber-700 bg-amber-50 text-neutral-900'
                          : 'border-neutral-200 bg-white text-neutral-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="service_category"
                        value={cat}
                        checked={category === cat}
                        onChange={() => setCategory(cat)}
                        className="h-4 w-4 accent-amber-700"
                      />
                      <span className="text-sm font-medium">{CATEGORY_LABELS[cat]}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-sm text-neutral-600">
                  {category === 'PIJAT'
                    ? 'Mendukung layanan di klinik dan di tempat pasien.'
                    : 'Otomatis hanya berlaku di klinik.'}
                </p>
              </div>

              <div>
                <label htmlFor="service_name" className="block text-sm font-medium text-neutral-800">
                  Nama Paket Layanan <span className="text-red-700">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="service_name"
                  name="serviceName"
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Contoh: Pijat Refleksi 90 Menit"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {errors.serviceName && (
                  <p className="mt-1.5 text-sm text-red-700">{errors.serviceName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="duration_minutes"
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Durasi (Menit) <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={durationRef}
                    id="duration_minutes"
                    name="durationMinutes"
                    type="number"
                    inputMode="numeric"
                    min={15}
                    max={360}
                    step={15}
                    value={durationStr}
                    onChange={(e) => setDurationStr(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                  {errors.duration && (
                    <p className="mt-1.5 text-sm text-red-700">{errors.duration}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="service_price" className="block text-sm font-medium text-neutral-800">
                    Harga (Rupiah) <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={priceRef}
                    id="service_price"
                    name="price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5000}
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                  {errors.price && (
                    <p className="mt-1.5 text-sm text-red-700">{errors.price}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 whitespace-nowrap"
                >
                  Simpan Layanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
