// Manajemen katalog layanan (Pijat & Facial), katalog produk, dan penjualan produk oleh terapis (FT-02 & FT-08).

import { Download, Edit3, Package, Plus, ShoppingBag, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS } from '../config';
import { exportProductSalesCsv } from '../lib/csvExport';
import { formatDateIndo, formatRupiah, getTodayYYYYMMDD } from '../lib/format';
import {
  calculateProductSaleCommission,
  calculateProductSalesSummary,
  type ProductSaleErrors,
  type ProductSaleFormInput,
  validateAndCreateProductSale,
} from '../lib/products';
import type { Product, ProductSale, Service, ServiceCategory, Therapist } from '../lib/types';

interface ServicesViewProps {
  services: Service[];
  products: Product[];
  productSales: ProductSale[];
  therapists: Therapist[];
  defaultDate?: string;
  onRequestSaveService: (mode: 'create' | 'edit', service: Service) => void;
  onRequestSaveProduct: (mode: 'create' | 'edit', product: Product) => void;
  onRequestAddProductSale: (sale: ProductSale) => void;
  onRequestCancelProductSale: (sale: ProductSale) => void;
}

type ServicesSectionTab = 'SERVICES' | 'PRODUCT_SALES';

export function ServicesView({
  services,
  products,
  productSales,
  therapists,
  defaultDate,
  onRequestSaveService,
  onRequestSaveProduct,
  onRequestAddProductSale,
  onRequestCancelProductSale,
}: ServicesViewProps) {
  const [sectionTab, setSectionTab] = useState<ServicesSectionTab>('SERVICES');
  const [filterCat, setFilterCat] = useState<'ALL' | ServiceCategory>('ALL');

  // State modal Layanan
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

  // State modal Produk
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productPriceStr, setProductPriceStr] = useState('85000');
  const [productActive, setProductActive] = useState(true);
  const [productErrors, setProductErrors] = useState<{
    productName?: string;
    price?: string;
  }>({});

  // State modal Catat Penjualan Produk
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleForm, setSaleForm] = useState<ProductSaleFormInput>({
    product_id: products[0]?.product_id ?? '',
    therapist_id: therapists.find((t) => t.is_active)?.therapist_id ?? '',
    buyer_name: '',
    quantity: '1',
    unit_price: String(products[0]?.price ?? 0),
    sale_date: defaultDate || getTodayYYYYMMDD(),
    notes: '',
  });
  const [saleErrors, setSaleErrors] = useState<ProductSaleErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const prodNameRef = useRef<HTMLInputElement>(null);
  const prodPriceRef = useRef<HTMLInputElement>(null);
  const saleProductRef = useRef<HTMLSelectElement>(null);
  const saleTherapistRef = useRef<HTMLSelectElement>(null);
  const saleQtyRef = useRef<HTMLInputElement>(null);
  const salePriceRef = useRef<HTMLInputElement>(null);
  const saleDateRef = useRef<HTMLInputElement>(null);

  const therapistMap = useMemo(
    () => new Map(therapists.map((t) => [t.therapist_id, t])),
    [therapists]
  );

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);
  const activeTherapists = useMemo(() => therapists.filter((t) => t.is_active), [therapists]);

  const sortedSales = useMemo(
    () =>
      productSales
        .slice()
        .sort((a, b) => {
          if (a.sale_date !== b.sale_date) return b.sale_date.localeCompare(a.sale_date);
          return b.created_at.localeCompare(a.created_at);
        }),
    [productSales]
  );

  const salesSummary = useMemo(
    () => calculateProductSalesSummary(productSales),
    [productSales]
  );

  const filtered = services.filter((s) =>
    filterCat === 'ALL' ? true : s.category === filterCat
  );

  // Handler Modal Layanan
  const openCreateService = () => {
    setEditingService(null);
    setCategory('PIJAT');
    setServiceName('');
    setDurationStr('60');
    setPriceStr('150000');
    setErrors({});
    setModalOpen(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setCategory(service.category);
    setServiceName(service.service_name);
    setDurationStr(String(service.duration_minutes));
    setPriceStr(String(service.price));
    setErrors({});
    setModalOpen(true);
  };

  const handleServiceSubmit = (e: React.FormEvent) => {
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

  // Handler Modal Produk
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPriceStr('85000');
    setProductActive(true);
    setProductErrors({});
    setProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductName(product.product_name);
    setProductPriceStr(String(product.price));
    setProductActive(product.is_active);
    setProductErrors({});
    setProductModalOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { productName?: string; price?: string } = {};
    const trimmedName = productName.trim();
    const cleanPrice = productPriceStr.trim();
    const parsedPrice = /^\d+$/.test(cleanPrice) ? Number(cleanPrice) : NaN;

    if (!trimmedName) {
      nextErrors.productName = 'Isi nama produk, contoh: Minyak Pijat Aromaterapi 100 ml.';
    }
    if (!Number.isSafeInteger(parsedPrice) || parsedPrice < 0) {
      nextErrors.price = 'Masukkan harga bulat tanpa titik atau koma, contoh: 85000.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setProductErrors(nextErrors);
      if (nextErrors.productName) prodNameRef.current?.focus();
      else if (nextErrors.price) prodPriceRef.current?.focus();
      return;
    }

    const nextProduct: Product = {
      product_id:
        editingProduct?.product_id ??
        `P-${Date.now().toString(36).toUpperCase().slice(-4)}`,
      product_name: trimmedName,
      price: Math.round(parsedPrice),
      is_active: productActive,
    };

    setProductModalOpen(false);
    onRequestSaveProduct(editingProduct ? 'edit' : 'create', nextProduct);
  };

  // Handler Modal Penjualan Produk
  const openCreateSale = () => {
    const firstProduct = activeProducts[0] ?? products[0];
    const firstTherapist = activeTherapists[0] ?? therapists[0];
    setSaleForm({
      product_id: firstProduct?.product_id ?? '',
      therapist_id: firstTherapist?.therapist_id ?? '',
      buyer_name: '',
      quantity: '1',
      unit_price: String(firstProduct?.price ?? 0),
      sale_date: defaultDate || getTodayYYYYMMDD(),
      notes: '',
    });
    setSaleErrors({});
    setSaleModalOpen(true);
  };

  const handleSaleProductChange = (nextProductId: string) => {
    const matched = products.find((p) => p.product_id === nextProductId);
    setSaleForm((prev) => ({
      ...prev,
      product_id: nextProductId,
      unit_price: matched ? String(matched.price) : prev.unit_price,
    }));
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateAndCreateProductSale({
      input: saleForm,
      products,
      therapists,
    });

    if (!res.valid || !res.sale) {
      setSaleErrors(res.errors);
      if (res.errors.product_id) saleProductRef.current?.focus();
      else if (res.errors.therapist_id) saleTherapistRef.current?.focus();
      else if (res.errors.quantity) saleQtyRef.current?.focus();
      else if (res.errors.unit_price) salePriceRef.current?.focus();
      else if (res.errors.sale_date) saleDateRef.current?.focus();
      return;
    }

    setSaleModalOpen(false);
    setSectionTab('PRODUCT_SALES');
    onRequestAddProductSale(res.sale);
  };

  const previewQty = /^\d+$/.test(saleForm.quantity.trim()) ? Number(saleForm.quantity.trim()) : 0;
  const previewPrice = /^\d+$/.test(saleForm.unit_price.trim())
    ? Number(saleForm.unit_price.trim())
    : 0;
  const previewTotal = Math.max(0, previewQty * previewPrice);
  const previewCommission = calculateProductSaleCommission(previewTotal);

  return (
    <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      {/* Header Utama */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Layanan & Penjualan Produk
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Kelola paket Pijat, Facial, katalog produk, serta penjualan produk beromzet dengan komisi
            terapis 10%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {sectionTab === 'SERVICES' ? (
            <button
              type="button"
              onClick={openCreateService}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 text-amber-700" />
              <span>Tambah Layanan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openCreateProduct}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Package className="h-4 w-4 text-amber-700" />
              <span>Tambah Produk</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateSale}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Catat Penjualan</span>
          </button>
        </div>
      </div>

      {/* Pemilih Sub-Menu: Paket Layanan vs Penjualan Produk */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div
          role="tablist"
          aria-label="Submenu layanan dan penjualan produk"
          className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'SERVICES'}
            onClick={() => setSectionTab('SERVICES')}
            className={`min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
              sectionTab === 'SERVICES'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Paket Layanan ({services.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'PRODUCT_SALES'}
            onClick={() => setSectionTab('PRODUCT_SALES')}
            className={`min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
              sectionTab === 'PRODUCT_SALES'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Penjualan Produk ({salesSummary.transactionCount})
          </button>
        </div>

        {sectionTab === 'SERVICES' && (
          <div className="flex flex-wrap items-center gap-3">
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
        )}
      </div>

      {/* Konten Sub-Tab 1: Paket Layanan */}
      {sectionTab === 'SERVICES' &&
        (filtered.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-base font-medium text-neutral-900">Belum ada paket layanan</p>
            <p className="mt-1 text-sm text-neutral-600">
              Tambahkan layanan Pijat atau Facial untuk mulai menerima reservasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
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
                        onClick={() => openEditService(s)}
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
        ))}

      {/* Konten Sub-Tab 2: Penjualan Produk & Katalog Produk */}
      {sectionTab === 'PRODUCT_SALES' && (
        <div className="space-y-6">
          {/* Ringkasan Omzet & Komisi Produk */}
          <div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <p className="text-sm text-neutral-600">Transaksi Penjualan Produk</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {salesSummary.transactionCount} transaksi ({salesSummary.unitCount} item)
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-neutral-600">Total Omzet Produk</p>
              <p className="mt-1 text-2xl font-bold text-amber-800 tabular-nums">
                {formatRupiah(salesSummary.totalRevenue)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-neutral-600">Komisi Terapis (10%)</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {formatRupiah(salesSummary.totalCommission)}
              </p>
            </div>
          </div>

          {/* Riwayat Penjualan Produk */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Riwayat Penjualan Produk</h2>
                <p className="text-sm text-neutral-600">
                  Otomatis masuk ke laporan pendapatan dan komisi 10% terapis penjual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportProductSalesCsv(productSales, therapists)}
                disabled={productSales.length === 0}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                <Download className="h-4 w-4 text-amber-700" />
                <span>Unduh CSV</span>
              </button>
            </div>

            {sortedSales.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
                <p className="text-base font-medium text-neutral-900">
                  Belum ada transaksi penjualan produk
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  Klik Catat Penjualan untuk merekam penjualan produk oleh terapis.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Produk & Pembeli</th>
                      <th className="px-4 py-3 font-semibold">Terapis Penjual</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Omzet</th>
                      <th className="px-4 py-3 text-right font-semibold">Komisi 10%</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {sortedSales.map((sale) => {
                      const therapist = therapistMap.get(sale.therapist_id);
                      const isCancelled = sale.status === 'CANCELLED';
                      const commission = isCancelled
                        ? 0
                        : calculateProductSaleCommission(sale.total_amount);

                      return (
                        <tr key={sale.sale_id} className="hover:bg-neutral-50/80">
                          <td className="px-4 py-3 text-neutral-800 tabular-nums whitespace-nowrap">
                            {formatDateIndo(sale.sale_date)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-neutral-900">{sale.product_name}</p>
                            <p className="text-xs text-neutral-600">
                              {sale.buyer_name ? `Pembeli: ${sale.buyer_name}` : 'Pembeli umum'}
                              {sale.notes ? ` · ${sale.notes}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            {therapist?.name ?? sale.therapist_id}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-900 tabular-nums">
                            {sale.quantity}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                              isCancelled
                                ? 'text-neutral-400 line-through'
                                : 'text-neutral-900'
                            }`}
                          >
                            {formatRupiah(sale.total_amount)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                              isCancelled
                                ? 'text-neutral-400 line-through'
                                : 'text-amber-800'
                            }`}
                          >
                            {formatRupiah(commission)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isCancelled
                                  ? 'bg-neutral-100 text-neutral-600'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {isCancelled ? 'Dibatalkan' : 'Selesai'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => onRequestCancelProductSale(sale)}
                                className="min-h-[36px] rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                              >
                                Batalkan
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Katalog Produk */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Katalog Produk Klinik</h2>
              <span className="text-sm text-neutral-600 tabular-nums">
                {products.length} produk terdaftar
              </span>
            </div>

            {products.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
                <p className="text-sm font-medium text-neutral-800">
                  Belum ada produk di katalog. Klik Tambah Produk untuk mulai menjual produk.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                      <th className="px-4 py-3 font-semibold">Nama Produk</th>
                      <th className="px-4 py-3 text-right font-semibold">Harga Satuan</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {products.map((prod) => (
                      <tr key={prod.product_id} className="hover:bg-neutral-50/80">
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {prod.product_name}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                          {formatRupiah(prod.price)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              prod.is_active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {prod.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditProduct(prod)}
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
          </div>
        </div>
      )}

      {/* Modal Tambah / Ubah Layanan */}
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

            <form onSubmit={handleServiceSubmit} noValidate className="mt-5 space-y-4">
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

      {/* Modal Tambah / Ubah Produk */}
      {productModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <h2 id="product-modal-title" className="text-lg font-semibold text-neutral-900">
                {editingProduct ? 'Ubah Data Produk' : 'Tambah Produk Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                aria-label="Tutup form produk"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label htmlFor="product_name" className="block text-sm font-medium text-neutral-800">
                  Nama Produk <span className="text-red-700">*</span>
                </label>
                <input
                  ref={prodNameRef}
                  id="product_name"
                  name="productName"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Contoh: Minyak Pijat Aromaterapi 100 ml"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {productErrors.productName && (
                  <p className="mt-1.5 text-sm text-red-700">{productErrors.productName}</p>
                )}
              </div>

              <div>
                <label htmlFor="product_price" className="block text-sm font-medium text-neutral-800">
                  Harga Satuan (Rupiah) <span className="text-red-700">*</span>
                </label>
                <input
                  ref={prodPriceRef}
                  id="product_price"
                  name="productPrice"
                  type="text"
                  inputMode="numeric"
                  value={productPriceStr}
                  onChange={(e) => setProductPriceStr(e.target.value)}
                  placeholder="Contoh: 85000"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {productErrors.price && (
                  <p className="mt-1.5 text-sm text-red-700">{productErrors.price}</p>
                )}
              </div>

              {editingProduct && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={productActive}
                    onChange={(e) => setProductActive(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-amber-700"
                  />
                  <span>Produk aktif dijual di klinik</span>
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 whitespace-nowrap"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Penjualan Produk */}
      {saleModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-sale-modal-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 id="product-sale-modal-title" className="text-lg font-semibold text-neutral-900">
                  Catat Penjualan Produk
                </h2>
                <p className="mt-0.5 text-sm text-neutral-600">
                  Omzet otomatis masuk laporan dan terapis mendapat komisi 10%.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaleModalOpen(false)}
                aria-label="Tutup form penjualan produk"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaleSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label htmlFor="sale_product" className="block text-sm font-medium text-neutral-800">
                  Pilih Produk <span className="text-red-700">*</span>
                </label>
                <select
                  ref={saleProductRef}
                  id="sale_product"
                  name="product_id"
                  value={saleForm.product_id}
                  onChange={(e) => handleSaleProductChange(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  {activeProducts.length === 0 && (
                    <option value="">Belum ada produk aktif</option>
                  )}
                  {activeProducts.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({formatRupiah(p.price)})
                    </option>
                  ))}
                </select>
                {saleErrors.product_id && (
                  <p className="mt-1.5 text-sm text-red-700">{saleErrors.product_id}</p>
                )}
              </div>

              <div>
                <label htmlFor="sale_therapist" className="block text-sm font-medium text-neutral-800">
                  Terapis Penjual <span className="text-red-700">*</span>
                </label>
                <select
                  ref={saleTherapistRef}
                  id="sale_therapist"
                  name="therapist_id"
                  value={saleForm.therapist_id}
                  onChange={(e) =>
                    setSaleForm((prev) => ({ ...prev, therapist_id: e.target.value }))
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  {activeTherapists.map((t) => (
                    <option key={t.therapist_id} value={t.therapist_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {saleErrors.therapist_id && (
                  <p className="mt-1.5 text-sm text-red-700">{saleErrors.therapist_id}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="sale_date" className="block text-sm font-medium text-neutral-800">
                    Tanggal <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={saleDateRef}
                    id="sale_date"
                    name="sale_date"
                    type="date"
                    value={saleForm.sale_date}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, sale_date: e.target.value }))
                    }
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                  {saleErrors.sale_date && (
                    <p className="mt-1.5 text-sm text-red-700">{saleErrors.sale_date}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sale_quantity" className="block text-sm font-medium text-neutral-800">
                    Jumlah <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={saleQtyRef}
                    id="sale_quantity"
                    name="quantity"
                    type="text"
                    inputMode="numeric"
                    value={saleForm.quantity}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    placeholder="1"
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                  {saleErrors.quantity && (
                    <p className="mt-1.5 text-sm text-red-700">{saleErrors.quantity}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sale_unit_price" className="block text-sm font-medium text-neutral-800">
                    Harga Satuan (Rp) <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={salePriceRef}
                    id="sale_unit_price"
                    name="unit_price"
                    type="text"
                    inputMode="numeric"
                    value={saleForm.unit_price}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, unit_price: e.target.value }))
                    }
                    placeholder="85000"
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                  {saleErrors.unit_price && (
                    <p className="mt-1.5 text-sm text-red-700">{saleErrors.unit_price}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sale_buyer" className="block text-sm font-medium text-neutral-800">
                    Nama Pembeli (Opsional)
                  </label>
                  <input
                    id="sale_buyer"
                    name="buyer_name"
                    type="text"
                    value={saleForm.buyer_name}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, buyer_name: e.target.value }))
                    }
                    placeholder="Contoh: Ibu Rina"
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                </div>

                <div>
                  <label htmlFor="sale_notes" className="block text-sm font-medium text-neutral-800">
                    Catatan (Opsional)
                  </label>
                  <input
                    id="sale_notes"
                    name="notes"
                    type="text"
                    value={saleForm.notes}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Keterangan tambahan"
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <div>
                  <span className="text-neutral-600">Total Omzet: </span>
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {formatRupiah(previewTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-600">Komisi Terapis (10%): </span>
                  <span className="font-bold text-amber-800 tabular-nums">
                    {formatRupiah(previewCommission)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setSaleModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 whitespace-nowrap"
                >
                  Simpan Penjualan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
