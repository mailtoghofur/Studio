// Operasi baca, tulis, dan sinkronisasi waktu-nyata ke Cloud Firestore untuk ruang kerja Naomi Beauty & Wellness.

import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { CLINIC_NAME, DEFAULT_PRODUCTS, DEFAULT_SERVICES, DEFAULT_THERAPISTS } from '../config';
import { OperationType, db, handleFirestoreError } from './firebase';
import {
  buildBookingPayload,
  buildProductPayload,
  buildProductSalePayload,
  buildServicePayload,
  buildTherapistPayload,
  buildWorkspacePayload,
} from './firestoreSchema';
import type {
  AccountDatabase,
  Booking,
  Product,
  ProductSale,
  Service,
  Therapist,
} from './types';

export interface WorkspaceSnapshotData {
  therapists: Therapist[];
  services: Service[];
  products: Product[];
  bookings: Booking[];
  product_sales: ProductSale[];
}

function fromBookingDoc(raw: Record<string, unknown>): Booking {
  const revisedAt = typeof raw.receipt_revised_at === 'string' ? raw.receipt_revised_at : '';
  const revisionReason =
    typeof raw.receipt_revision_reason === 'string' ? raw.receipt_revision_reason : '';
  return {
    booking_id: String(raw.booking_id ?? ''),
    patient_name: String(raw.patient_name ?? ''),
    patient_phone: String(raw.patient_phone ?? ''),
    service_id: String(raw.service_id ?? ''),
    therapist_id: String(raw.therapist_id ?? ''),
    booking_date: String(raw.booking_date ?? ''),
    start_time: String(raw.start_time ?? '10:00'),
    end_time: String(raw.end_time ?? '11:00'),
    location_type: raw.location_type === 'HOME_SERVICE' ? 'HOME_SERVICE' : 'CLINIC',
    patient_address: String(raw.patient_address ?? ''),
    notes: String(raw.notes ?? ''),
    status:
      raw.status === 'COMPLETED' || raw.status === 'CANCELLED' ? raw.status : 'SCHEDULED',
    is_loyalty_reward: Boolean(raw.is_loyalty_reward),
    discount_percent:
      raw.discount_percent === 10 || raw.discount_percent === 20 ? raw.discount_percent : 0,
    discount_amount: Number(raw.discount_amount ?? 0),
    final_price: Number(raw.final_price ?? 0),
    receipt_revised_at: revisedAt || undefined,
    receipt_revision_reason: revisionReason || undefined,
    created_at: String(raw.created_at_iso ?? new Date().toISOString()),
    updated_at: String(raw.updated_at_iso ?? new Date().toISOString()),
  };
}

function fromProductSaleDoc(raw: Record<string, unknown>): ProductSale {
  return {
    sale_id: String(raw.sale_id ?? ''),
    product_id: String(raw.product_id ?? ''),
    product_name: String(raw.product_name ?? ''),
    therapist_id: String(raw.therapist_id ?? ''),
    buyer_name: String(raw.buyer_name ?? ''),
    quantity: Number(raw.quantity ?? 1),
    unit_price: Number(raw.unit_price ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    sale_date: String(raw.sale_date ?? ''),
    notes: String(raw.notes ?? ''),
    status: raw.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
    created_at: String(raw.created_at_iso ?? new Date().toISOString()),
    updated_at: String(raw.updated_at_iso ?? new Date().toISOString()),
  };
}

export async function ensureWorkspaceInitialized(
  user: User,
  seedDb?: Partial<AccountDatabase> | null
): Promise<boolean> {
  const workspacePath = `workspaces/${user.uid}`;
  const workspaceRef = doc(db, 'workspaces', user.uid);

  let exists = false;
  try {
    const snap = await getDoc(workspaceRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }

  if (exists) {
    return false;
  }

  const therapists =
    seedDb?.therapists && seedDb.therapists.length > 0 ? seedDb.therapists : DEFAULT_THERAPISTS;
  const services =
    seedDb?.services && seedDb.services.length > 0 ? seedDb.services : DEFAULT_SERVICES;
  const products =
    seedDb?.products && seedDb.products.length > 0 ? seedDb.products : DEFAULT_PRODUCTS;
  const bookings = seedDb?.bookings ?? [];
  const productSales = seedDb?.product_sales ?? [];

  const workspacePayload = buildWorkspacePayload({
    uid: user.uid,
    clinicName: CLINIC_NAME,
    ownerName: user.displayName || seedDb?.owner_username || 'Admin Klinik',
    ownerEmail: user.email || 'klinik@example.com',
  });

  try {
    const masterBatch = writeBatch(db);
    masterBatch.set(workspaceRef, {
      ...workspacePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const therapistIds = new Set<string>();
    for (const therapist of therapists) {
      const payload = buildTherapistPayload(user.uid, user.uid, therapist);
      therapistIds.add(payload.therapist_id);
      masterBatch.set(doc(db, 'workspaces', user.uid, 'therapists', payload.therapist_id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const serviceIds = new Set<string>();
    for (const service of services) {
      const payload = buildServicePayload(user.uid, user.uid, service);
      serviceIds.add(payload.service_id);
      masterBatch.set(doc(db, 'workspaces', user.uid, 'services', payload.service_id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const productIds = new Set<string>();
    for (const product of products) {
      const payload = buildProductPayload(user.uid, user.uid, product);
      productIds.add(payload.product_id);
      masterBatch.set(doc(db, 'workspaces', user.uid, 'products', payload.product_id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await masterBatch.commit();

    const validBookings = bookings.filter((b) => {
      const p = buildBookingPayload(user.uid, user.uid, b);
      return serviceIds.has(p.service_id) && therapistIds.has(p.therapist_id);
    });
    const validSales = productSales.filter((s) => {
      const p = buildProductSalePayload(user.uid, user.uid, s);
      return productIds.has(p.product_id) && therapistIds.has(p.therapist_id);
    });

    for (let i = 0; i < validBookings.length; i += 400) {
      const chunk = validBookings.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const b of chunk) {
        const payload = buildBookingPayload(user.uid, user.uid, b);
        batch.set(doc(db, 'workspaces', user.uid, 'bookings', payload.booking_id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    for (let i = 0; i < validSales.length; i += 400) {
      const chunk = validSales.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const s of chunk) {
        const payload = buildProductSalePayload(user.uid, user.uid, s);
        batch.set(doc(db, 'workspaces', user.uid, 'product_sales', payload.sale_id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }

  return true;
}

export function subscribeWorkspaceCollections(
  uid: string,
  callbacks: {
    onTherapists: (items: Therapist[]) => void;
    onServices: (items: Service[]) => void;
    onProducts: (items: Product[]) => void;
    onBookings: (items: Booking[]) => void;
    onProductSales: (items: ProductSale[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const captureError = (error: unknown, path: string) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrapped) {
      callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  const therapistsPath = `workspaces/${uid}/therapists`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'workspaces', uid, 'therapists'), where('ownerId', '==', uid)),
      (snapshot) => {
        const items: Therapist[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            therapist_id: String(data.therapist_id ?? d.id),
            name: String(data.name ?? ''),
            is_active: Boolean(data.is_active),
          };
        });
        items.sort((a, b) => a.therapist_id.localeCompare(b.therapist_id));
        if (items.length > 0) callbacks.onTherapists(items);
      },
      (err) => captureError(err, therapistsPath)
    )
  );

  const servicesPath = `workspaces/${uid}/services`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'workspaces', uid, 'services'), where('ownerId', '==', uid)),
      (snapshot) => {
        const items: Service[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            service_id: String(data.service_id ?? d.id),
            category: data.category === 'FACIAL' ? 'FACIAL' : 'PIJAT',
            service_name: String(data.service_name ?? ''),
            duration_minutes: Number(data.duration_minutes ?? 60),
            price: Number(data.price ?? 0),
            allow_home_service: Boolean(data.allow_home_service),
          };
        });
        items.sort((a, b) => a.service_id.localeCompare(b.service_id));
        if (items.length > 0) callbacks.onServices(items);
      },
      (err) => captureError(err, servicesPath)
    )
  );

  const productsPath = `workspaces/${uid}/products`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'workspaces', uid, 'products'), where('ownerId', '==', uid)),
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            product_id: String(data.product_id ?? d.id),
            product_name: String(data.product_name ?? ''),
            price: Number(data.price ?? 0),
            is_active: Boolean(data.is_active),
          };
        });
        items.sort((a, b) => a.product_id.localeCompare(b.product_id));
        if (items.length > 0) callbacks.onProducts(items);
      },
      (err) => captureError(err, productsPath)
    )
  );

  const bookingsPath = `workspaces/${uid}/bookings`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'workspaces', uid, 'bookings'), where('ownerId', '==', uid)),
      (snapshot) => {
        const items = snapshot.docs.map((d) => fromBookingDoc(d.data()));
        items.sort((a, b) => a.created_at.localeCompare(b.created_at));
        callbacks.onBookings(items);
      },
      (err) => captureError(err, bookingsPath)
    )
  );

  const salesPath = `workspaces/${uid}/product_sales`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'workspaces', uid, 'product_sales'), where('ownerId', '==', uid)),
      (snapshot) => {
        const items = snapshot.docs.map((d) => fromProductSaleDoc(d.data()));
        items.sort((a, b) => a.created_at.localeCompare(b.created_at));
        callbacks.onProductSales(items);
      },
      (err) => captureError(err, salesPath)
    )
  );

  return () => {
    for (const unsub of unsubscribers) unsub();
  };
}

export async function saveTherapistToFirestore(uid: string, therapist: Therapist): Promise<void> {
  const payload = buildTherapistPayload(uid, uid, therapist);
  const path = `workspaces/${uid}/therapists/${payload.therapist_id}`;
  const docRef = doc(db, 'workspaces', uid, 'therapists', payload.therapist_id);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        name: payload.name,
        is_active: payload.is_active,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveTherapistsToFirestore(
  uid: string,
  therapists: Therapist[]
): Promise<void> {
  for (const therapist of therapists) {
    await saveTherapistToFirestore(uid, therapist);
  }
}

export async function saveServiceToFirestore(uid: string, service: Service): Promise<void> {
  const payload = buildServicePayload(uid, uid, service);
  const path = `workspaces/${uid}/services/${payload.service_id}`;
  const docRef = doc(db, 'workspaces', uid, 'services', payload.service_id);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        category: payload.category,
        service_name: payload.service_name,
        duration_minutes: payload.duration_minutes,
        price: payload.price,
        allow_home_service: payload.allow_home_service,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveProductToFirestore(uid: string, product: Product): Promise<void> {
  const payload = buildProductPayload(uid, uid, product);
  const path = `workspaces/${uid}/products/${payload.product_id}`;
  const docRef = doc(db, 'workspaces', uid, 'products', payload.product_id);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        product_name: payload.product_name,
        price: payload.price,
        is_active: payload.is_active,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveBookingToFirestore(
  uid: string,
  booking: Booking,
  action: 'create' | 'reschedule' | 'status' | 'revise'
): Promise<void> {
  const payload = buildBookingPayload(uid, uid, booking);
  const path = `workspaces/${uid}/bookings/${payload.booking_id}`;
  const docRef = doc(db, 'workspaces', uid, 'bookings', payload.booking_id);
  try {
    if (action === 'create') {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (action === 'reschedule') {
      await updateDoc(docRef, {
        patient_name: payload.patient_name,
        patient_phone: payload.patient_phone,
        service_id: payload.service_id,
        therapist_id: payload.therapist_id,
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        location_type: payload.location_type,
        patient_address: payload.patient_address,
        notes: payload.notes,
        updated_at_iso: payload.updated_at_iso,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (action === 'status') {
      await updateDoc(docRef, {
        status: payload.status,
        discount_percent: payload.discount_percent,
        discount_amount: payload.discount_amount,
        final_price: payload.final_price,
        updated_at_iso: payload.updated_at_iso,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // Action: Post-completion receipt correction (Perbaikan Resi)
    await updateDoc(docRef, {
      patient_name: payload.patient_name,
      patient_phone: payload.patient_phone,
      service_id: payload.service_id,
      therapist_id: payload.therapist_id,
      booking_date: payload.booking_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      location_type: payload.location_type,
      patient_address: payload.patient_address,
      notes: payload.notes,
      discount_percent: payload.discount_percent,
      discount_amount: payload.discount_amount,
      final_price: payload.final_price,
      receipt_revised_at: payload.receipt_revised_at || new Date().toISOString(),
      receipt_revision_reason: payload.receipt_revision_reason,
      updated_at_iso: payload.updated_at_iso,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveProductSaleToFirestore(
  uid: string,
  sale: ProductSale,
  action: 'create' | 'cancel'
): Promise<void> {
  const payload = buildProductSalePayload(uid, uid, sale);
  const path = `workspaces/${uid}/product_sales/${payload.sale_id}`;
  const docRef = doc(db, 'workspaces', uid, 'product_sales', payload.sale_id);
  try {
    if (action === 'create') {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    await updateDoc(docRef, {
      status: payload.status,
      updated_at_iso: payload.updated_at_iso,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncLocalDatabaseToFirestore(
  user: User,
  database: AccountDatabase
): Promise<void> {
  const uid = user.uid;
  await ensureWorkspaceInitialized(user, database);

  for (const t of database.therapists) {
    await saveTherapistToFirestore(uid, t);
  }
  for (const s of database.services) {
    await saveServiceToFirestore(uid, s);
  }
  for (const p of database.products ?? DEFAULT_PRODUCTS) {
    await saveProductToFirestore(uid, p);
  }

  const therapistIds = new Set(database.therapists.map((t) => buildTherapistPayload(uid, uid, t).therapist_id));
  const serviceIds = new Set(database.services.map((s) => buildServicePayload(uid, uid, s).service_id));
  const productIds = new Set(
    (database.products ?? DEFAULT_PRODUCTS).map((p) => buildProductPayload(uid, uid, p).product_id)
  );

  for (const b of database.bookings) {
    const bp = buildBookingPayload(uid, uid, b);
    if (!therapistIds.has(bp.therapist_id) || !serviceIds.has(bp.service_id)) continue;
    const bookingRef = doc(db, 'workspaces', uid, 'bookings', bp.booking_id);
    const snap = await getDoc(bookingRef);
    if (!snap.exists()) {
      await saveBookingToFirestore(uid, b, 'create');
    } else if (bp.status === 'SCHEDULED') {
      await saveBookingToFirestore(uid, b, 'reschedule');
    } else if (bp.status === 'COMPLETED' && bp.receipt_revised_at) {
      await saveBookingToFirestore(uid, b, 'revise');
    }
  }

  for (const sale of database.product_sales ?? []) {
    const sp = buildProductSalePayload(uid, uid, sale);
    if (!therapistIds.has(sp.therapist_id) || !productIds.has(sp.product_id)) continue;
    const saleRef = doc(db, 'workspaces', uid, 'product_sales', sp.sale_id);
    const snap = await getDoc(saleRef);
    if (!snap.exists()) {
      await saveProductSaleToFirestore(uid, sale, 'create');
    } else if (sp.status === 'CANCELLED' && snap.data()?.status === 'COMPLETED') {
      await saveProductSaleToFirestore(uid, sale, 'cancel');
    }
  }
}

export async function resetFirestoreBookingsAndSales(
  user: User,
  freshDb: AccountDatabase
): Promise<void> {
  const uid = user.uid;
  const bookingsPath = `workspaces/${uid}/bookings`;
  try {
    const bookingSnap = await getDocs(
      query(collection(db, 'workspaces', uid, 'bookings'), where('ownerId', '==', uid))
    );
    for (let i = 0; i < bookingSnap.docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of bookingSnap.docs.slice(i, i + 400)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    const salesSnap = await getDocs(
      query(collection(db, 'workspaces', uid, 'product_sales'), where('ownerId', '==', uid))
    );
    for (let i = 0; i < salesSnap.docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of salesSnap.docs.slice(i, i + 400)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, bookingsPath);
  }

  await saveTherapistsToFirestore(uid, freshDb.therapists);
  for (const s of freshDb.services) {
    await saveServiceToFirestore(uid, s);
  }
  for (const p of freshDb.products ?? DEFAULT_PRODUCTS) {
    await saveProductToFirestore(uid, p);
  }
}
