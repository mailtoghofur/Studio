// Layanan database cloud Firestore dan autentikasi username/password multi-browser untuk Naomi Beauty & Wellness.

import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  Timestamp,
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
import { CLINIC_NAME, DEFAULT_SERVICES, DEFAULT_THERAPISTS } from '../config';
import { auth, db, getProvisionerAuth, usernameToInternalEmail } from './firebase';
import { OperationType, handleFirestoreError } from './firebaseErrors';
import type {
  AccountDatabase,
  Booking,
  BookingStatus,
  Service,
  Therapist,
  UserAccount,
  UserRole,
} from './types';

export interface WorkspaceMetadata {
  workspaceId: string;
  ownerUid: string;
  ownerUsername: string;
  clinicName: string;
  adminUids: string[];
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

function mapUserDocToAccount(data: Record<string, unknown>): UserAccount {
  const uid = String(data.uid ?? '');
  const workspaceId = String(data.workspace_id ?? '');
  const therapistId = typeof data.therapist_id === 'string' && data.therapist_id ? data.therapist_id : undefined;
  return {
    account_id: uid,
    uid,
    username: String(data.username ?? ''),
    display_name: String(data.display_name ?? ''),
    role: data.role === 'ADMIN' ? 'ADMIN' : 'THERAPIST',
    therapist_id: therapistId,
    workspace_id: workspaceId,
    owner_account_id: workspaceId,
    created_by_uid: typeof data.created_by_uid === 'string' ? data.created_by_uid : undefined,
    created_by_owner_id: typeof data.created_by_uid === 'string' ? data.created_by_uid : undefined,
    is_master: Boolean(data.is_master),
    is_active: Boolean(data.is_active),
    created_at: timestampToIso(data.createdAt),
    updated_at: timestampToIso(data.updatedAt),
  };
}

function mapMemberDocToAccount(
  data: Record<string, unknown>,
  workspaceId: string
): UserAccount {
  const uid = String(data.uid ?? '');
  const therapistId = typeof data.therapist_id === 'string' && data.therapist_id ? data.therapist_id : undefined;
  return {
    account_id: uid,
    uid,
    username: String(data.username ?? ''),
    display_name: String(data.display_name ?? ''),
    role: data.role === 'ADMIN' ? 'ADMIN' : 'THERAPIST',
    therapist_id: therapistId,
    workspace_id: workspaceId,
    owner_account_id: String(data.owner_uid ?? workspaceId),
    is_master: Boolean(data.is_master),
    is_active: Boolean(data.is_active),
    created_at: timestampToIso(data.updatedAt),
    updated_at: timestampToIso(data.updatedAt),
  };
}

function mapBookingDoc(data: Record<string, unknown>): Booking {
  return {
    booking_id: String(data.booking_id ?? ''),
    patient_name: String(data.patient_name ?? ''),
    patient_phone: String(data.patient_phone ?? ''),
    service_id: String(data.service_id ?? ''),
    therapist_id: String(data.therapist_id ?? ''),
    booking_date: String(data.booking_date ?? ''),
    start_time: String(data.start_time ?? ''),
    end_time: String(data.end_time ?? ''),
    location_type: data.location_type === 'HOME_SERVICE' ? 'HOME_SERVICE' : 'CLINIC',
    patient_address: String(data.patient_address ?? ''),
    notes: String(data.notes ?? ''),
    status:
      data.status === 'COMPLETED'
        ? 'COMPLETED'
        : data.status === 'CANCELLED'
          ? 'CANCELLED'
          : 'SCHEDULED',
    created_at: timestampToIso(data.createdAt),
    updated_at: timestampToIso(data.updatedAt),
  };
}

export async function checkSystemInitialized(): Promise<boolean> {
  const path = 'system/meta';
  try {
    const snap = await getDoc(doc(db, 'system', 'meta'));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchCurrentUserProfile(uid: string): Promise<UserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return mapUserDocToAccount(snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function bootstrapMasterWorkspace(params: {
  username: string;
  displayName: string;
  password: string;
  initialData?: {
    therapists?: Therapist[];
    services?: Service[];
    bookings?: Booking[];
  };
}): Promise<UserAccount> {
  const cleanUser = params.username.trim();
  const cleanDisplay = params.displayName.trim() || 'Admin Master';
  const email = usernameToInternalEmail(cleanUser);

  const cred = await createUserWithEmailAndPassword(auth, email, params.password);
  const uid = cred.user.uid;
  const workspaceId = `WS-${uid}`;

  const seedTherapists =
    params.initialData?.therapists && params.initialData.therapists.length > 0
      ? params.initialData.therapists
      : DEFAULT_THERAPISTS;
  const seedServices =
    params.initialData?.services && params.initialData.services.length > 0
      ? params.initialData.services
      : DEFAULT_SERVICES;

  const batchPath = `workspaces/${workspaceId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'system', 'meta'), {
      initialized: true,
      masterUid: uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admins', uid), {
      uid,
      isMaster: true,
      workspaceId,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), {
      uid,
      username: cleanUser,
      display_name: cleanDisplay,
      role: 'ADMIN',
      workspace_id: workspaceId,
      therapist_id: '',
      is_active: true,
      is_master: true,
      created_by_uid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'workspaces', workspaceId), {
      workspaceId,
      ownerUid: uid,
      ownerUsername: cleanUser,
      clinicName: CLINIC_NAME,
      adminUids: [uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'workspaces', workspaceId, 'members', uid), {
      uid,
      owner_uid: uid,
      admin_uids: [uid],
      username: cleanUser,
      display_name: cleanDisplay,
      role: 'ADMIN',
      therapist_id: '',
      is_active: true,
      is_master: true,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'workspaces', workspaceId, 'config', 'therapists'), {
      ownerUid: uid,
      items: seedTherapists,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'workspaces', workspaceId, 'config', 'services'), {
      ownerUid: uid,
      items: seedServices,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, batchPath);
  }

  const seedBookings = params.initialData?.bookings ?? [];
  if (seedBookings.length > 0) {
    const bookingsPath = `workspaces/${workspaceId}/bookings`;
    try {
      for (let i = 0; i < seedBookings.length; i += 400) {
        const chunk = seedBookings.slice(i, i + 400);
        const bBatch = writeBatch(db);
        for (const booking of chunk) {
          bBatch.set(doc(db, 'workspaces', workspaceId, 'bookings', booking.booking_id), {
            booking_id: booking.booking_id,
            workspace_id: workspaceId,
            owner_uid: uid,
            admin_uids: [uid],
            therapist_uid: '',
            patient_name: booking.patient_name,
            patient_phone: booking.patient_phone,
            service_id: booking.service_id,
            therapist_id: booking.therapist_id,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            location_type: booking.location_type,
            patient_address: booking.patient_address ?? '',
            notes: booking.notes ?? '',
            status: booking.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await bBatch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, bookingsPath);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    account_id: uid,
    uid,
    username: cleanUser,
    display_name: cleanDisplay,
    role: 'ADMIN',
    workspace_id: workspaceId,
    owner_account_id: workspaceId,
    created_by_uid: uid,
    is_master: true,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function loginWithUsernamePassword(
  username: string,
  password: string
): Promise<UserAccount> {
  const email = usernameToInternalEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchCurrentUserProfile(cred.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error('Profil akun tidak ditemukan di database cloud.');
  }
  if (!profile.is_active) {
    await signOut(auth);
    throw new Error(
      'Akun ini sedang dinonaktifkan oleh Admin. Hubungi Admin Master untuk mengaktifkan kembali.'
    );
  }
  return profile;
}

export async function logoutCloudSession(): Promise<void> {
  await signOut(auth);
}

export async function changeOwnCloudPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Sesi masuk tidak ditemukan. Silakan masuk ulang.');
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function subscribeWorkspace(
  workspaceId: string,
  caller: UserAccount,
  callbacks: {
    onWorkspace: (ws: WorkspaceMetadata) => void;
    onTherapists: (items: Therapist[]) => void;
    onServices: (items: Service[]) => void;
    onBookings: (items: Booking[]) => void;
    onWorkspaceMembers: (members: UserAccount[]) => void;
    onCreatedAccounts: (accounts: UserAccount[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const handleListenerError = (path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch (wrapped) {
      callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  const wsPath = `workspaces/${workspaceId}`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'workspaces', workspaceId),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onWorkspace({
          workspaceId: String(d.workspaceId ?? workspaceId),
          ownerUid: String(d.ownerUid ?? ''),
          ownerUsername: String(d.ownerUsername ?? ''),
          clinicName: String(d.clinicName ?? CLINIC_NAME),
          adminUids: Array.isArray(d.adminUids) ? d.adminUids.map(String) : [],
        });
      },
      handleListenerError(wsPath)
    )
  );

  const therapistsPath = `workspaces/${workspaceId}/config/therapists`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'workspaces', workspaceId, 'config', 'therapists'),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (Array.isArray(d.items)) {
          callbacks.onTherapists(d.items as Therapist[]);
        }
      },
      handleListenerError(therapistsPath)
    )
  );

  const servicesPath = `workspaces/${workspaceId}/config/services`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'workspaces', workspaceId, 'config', 'services'),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (Array.isArray(d.items)) {
          callbacks.onServices(d.items as Service[]);
        }
      },
      handleListenerError(servicesPath)
    )
  );

  const bookingsPath = `workspaces/${workspaceId}/bookings`;
  const bookingsQuery =
    caller.role === 'ADMIN'
      ? query(
          collection(db, 'workspaces', workspaceId, 'bookings'),
          where('admin_uids', 'array-contains', caller.uid)
        )
      : query(
          collection(db, 'workspaces', workspaceId, 'bookings'),
          where('therapist_uid', '==', caller.uid)
        );

  unsubscribers.push(
    onSnapshot(
      bookingsQuery,
      (snap) => {
        const list = snap.docs.map((docSnap) => mapBookingDoc(docSnap.data()));
        callbacks.onBookings(list);
      },
      handleListenerError(bookingsPath)
    )
  );

  if (caller.role === 'ADMIN') {
    const membersPath = `workspaces/${workspaceId}/members`;
    const membersQuery = query(
      collection(db, 'workspaces', workspaceId, 'members'),
      where('admin_uids', 'array-contains', caller.uid)
    );
    unsubscribers.push(
      onSnapshot(
        membersQuery,
        (snap) => {
          const members = snap.docs.map((docSnap) =>
            mapMemberDocToAccount(docSnap.data(), workspaceId)
          );
          callbacks.onWorkspaceMembers(members);
        },
        handleListenerError(membersPath)
      )
    );

    const createdUsersPath = 'users';
    const createdUsersQuery = query(
      collection(db, 'users'),
      where('created_by_uid', '==', caller.uid)
    );
    unsubscribers.push(
      onSnapshot(
        createdUsersQuery,
        (snap) => {
          const created = snap.docs.map((docSnap) => mapUserDocToAccount(docSnap.data()));
          callbacks.onCreatedAccounts(created);
        },
        handleListenerError(createdUsersPath)
      )
    );
  }

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}

export async function createCloudAccount(params: {
  creatorUid: string;
  workspaceId: string;
  workspaceOwnerUid: string;
  workspaceAdminUids: string[];
  username: string;
  display_name: string;
  password: string;
  role: UserRole;
  therapist_id?: string;
  databaseMode: 'shared' | 'separate';
}): Promise<UserAccount> {
  const cleanUser = params.username.trim();
  const cleanDisplay = params.display_name.trim() || cleanUser;
  const email = usernameToInternalEmail(cleanUser);

  const provisionerAuth = getProvisionerAuth();
  const newCred = await createUserWithEmailAndPassword(
    provisionerAuth,
    email,
    params.password
  );
  const newUid = newCred.user.uid;
  await signOut(provisionerAuth);

  const isSeparateDb = params.role === 'ADMIN' && params.databaseMode === 'separate';
  const targetWorkspaceId = isSeparateDb ? `WS-${newUid}` : params.workspaceId;

  const path = `users/${newUid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', newUid), {
      uid: newUid,
      username: cleanUser,
      display_name: cleanDisplay,
      role: params.role,
      workspace_id: targetWorkspaceId,
      therapist_id: params.role === 'THERAPIST' ? params.therapist_id ?? '' : '',
      is_active: true,
      is_master: false,
      created_by_uid: params.creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (isSeparateDb) {
      batch.set(doc(db, 'admins', newUid), {
        uid: newUid,
        isMaster: false,
        workspaceId: targetWorkspaceId,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'workspaces', targetWorkspaceId), {
        workspaceId: targetWorkspaceId,
        ownerUid: newUid,
        ownerUsername: cleanUser,
        clinicName: CLINIC_NAME,
        adminUids: [newUid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'workspaces', targetWorkspaceId, 'members', newUid), {
        uid: newUid,
        owner_uid: newUid,
        admin_uids: [newUid],
        username: cleanUser,
        display_name: cleanDisplay,
        role: 'ADMIN',
        therapist_id: '',
        is_active: true,
        is_master: false,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'workspaces', targetWorkspaceId, 'config', 'therapists'), {
        ownerUid: newUid,
        items: DEFAULT_THERAPISTS,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'workspaces', targetWorkspaceId, 'config', 'services'), {
        ownerUid: newUid,
        items: DEFAULT_SERVICES,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      const nextAdminUids =
        params.role === 'ADMIN' && !params.workspaceAdminUids.includes(newUid)
          ? [...params.workspaceAdminUids, newUid]
          : params.workspaceAdminUids;

      batch.set(doc(db, 'workspaces', params.workspaceId, 'members', newUid), {
        uid: newUid,
        owner_uid: params.workspaceOwnerUid,
        admin_uids: nextAdminUids,
        username: cleanUser,
        display_name: cleanDisplay,
        role: params.role,
        therapist_id: params.role === 'THERAPIST' ? params.therapist_id ?? '' : '',
        is_active: true,
        is_master: false,
        updatedAt: serverTimestamp(),
      });

      if (params.role === 'ADMIN') {
        batch.set(doc(db, 'admins', newUid), {
          uid: newUid,
          isMaster: false,
          workspaceId: params.workspaceId,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'workspaces', params.workspaceId), {
          adminUids: nextAdminUids,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      if (params.role === 'ADMIN') {
        await propagateAdminUidsToWorkspace(
          params.workspaceId,
          params.creatorUid,
          nextAdminUids
        );
      } else if (params.role === 'THERAPIST' && params.therapist_id) {
        await assignTherapistUidToBookings(
          params.workspaceId,
          params.creatorUid,
          params.therapist_id,
          newUid
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  const nowIso = new Date().toISOString();
  return {
    account_id: newUid,
    uid: newUid,
    username: cleanUser,
    display_name: cleanDisplay,
    role: params.role,
    therapist_id: params.role === 'THERAPIST' ? params.therapist_id : undefined,
    workspace_id: targetWorkspaceId,
    owner_account_id: targetWorkspaceId,
    created_by_uid: params.creatorUid,
    created_by_owner_id: isSeparateDb ? params.workspaceId : undefined,
    is_master: false,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

async function propagateAdminUidsToWorkspace(
  workspaceId: string,
  callerUid: string,
  nextAdminUids: string[]
): Promise<void> {
  const membersSnap = await getDocs(
    query(
      collection(db, 'workspaces', workspaceId, 'members'),
      where('admin_uids', 'array-contains', callerUid)
    )
  );
  const bookingsSnap = await getDocs(
    query(
      collection(db, 'workspaces', workspaceId, 'bookings'),
      where('admin_uids', 'array-contains', callerUid)
    )
  );

  const batch = writeBatch(db);
  for (const mDoc of membersSnap.docs) {
    batch.update(mDoc.ref, { admin_uids: nextAdminUids, updatedAt: serverTimestamp() });
  }
  for (const bDoc of bookingsSnap.docs) {
    batch.update(bDoc.ref, { admin_uids: nextAdminUids, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

async function assignTherapistUidToBookings(
  workspaceId: string,
  callerUid: string,
  therapistId: string,
  therapistUid: string
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'workspaces', workspaceId, 'bookings'),
      where('admin_uids', 'array-contains', callerUid)
    )
  );
  const matching = snap.docs.filter((d) => d.data().therapist_id === therapistId);
  if (matching.length === 0) return;

  const batch = writeBatch(db);
  for (const bDoc of matching) {
    batch.update(bDoc.ref, {
      therapist_uid: therapistUid,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function toggleCloudAccountActive(
  target: UserAccount,
  nextActive: boolean,
  currentWorkspaceId: string
): Promise<void> {
  const path = `users/${target.uid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', target.uid), {
      is_active: nextActive,
      updatedAt: serverTimestamp(),
    });
    if (target.workspace_id === currentWorkspaceId) {
      batch.update(doc(db, 'workspaces', currentWorkspaceId, 'members', target.uid), {
        is_active: nextActive,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudAccount(
  target: UserAccount,
  currentWorkspaceId: string
): Promise<void> {
  const path = `users/${target.uid}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', target.uid));
    if (target.role === 'ADMIN') {
      batch.delete(doc(db, 'admins', target.uid));
    }
    if (target.workspace_id === currentWorkspaceId) {
      batch.delete(doc(db, 'workspaces', currentWorkspaceId, 'members', target.uid));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveWorkspaceTherapists(
  workspaceId: string,
  therapists: Therapist[]
): Promise<void> {
  const path = `workspaces/${workspaceId}/config/therapists`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'config', 'therapists'), {
      items: therapists,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWorkspaceServices(
  workspaceId: string,
  services: Service[]
): Promise<void> {
  const path = `workspaces/${workspaceId}/config/services`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'config', 'services'), {
      items: services,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWorkspaceBooking(params: {
  mode: 'create' | 'reschedule';
  workspaceId: string;
  ownerUid: string;
  adminUids: string[];
  therapistUid: string;
  booking: Booking;
}): Promise<void> {
  const { mode, workspaceId, ownerUid, adminUids, therapistUid, booking } = params;
  const path = `workspaces/${workspaceId}/bookings/${booking.booking_id}`;
  const docRef = doc(db, 'workspaces', workspaceId, 'bookings', booking.booking_id);
  try {
    if (mode === 'create') {
      await setDoc(docRef, {
        booking_id: booking.booking_id,
        workspace_id: workspaceId,
        owner_uid: ownerUid,
        admin_uids: adminUids,
        therapist_uid: therapistUid,
        patient_name: booking.patient_name,
        patient_phone: booking.patient_phone,
        service_id: booking.service_id,
        therapist_id: booking.therapist_id,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        location_type: booking.location_type,
        patient_address: booking.patient_address ?? '',
        notes: booking.notes ?? '',
        status: booking.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        patient_name: booking.patient_name,
        patient_phone: booking.patient_phone,
        service_id: booking.service_id,
        therapist_id: booking.therapist_id,
        therapist_uid: therapistUid,
        admin_uids: adminUids,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        location_type: booking.location_type,
        patient_address: booking.patient_address ?? '',
        notes: booking.notes ?? '',
        status: booking.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateWorkspaceBookingStatus(params: {
  workspaceId: string;
  bookingId: string;
  status: BookingStatus;
}): Promise<void> {
  const { workspaceId, bookingId, status } = params;
  const path = `workspaces/${workspaceId}/bookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'bookings', bookingId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function importWorkspaceDatabaseToCloud(params: {
  workspaceId: string;
  ownerUid: string;
  adminUids: string[];
  existingBookingIds: string[];
  imported: AccountDatabase;
  therapistUidByTherapistId: Map<string, string>;
}): Promise<void> {
  const {
    workspaceId,
    ownerUid,
    adminUids,
    existingBookingIds,
    imported,
    therapistUidByTherapistId,
  } = params;
  const path = `workspaces/${workspaceId}`;
  try {
    await saveWorkspaceTherapists(workspaceId, imported.therapists);
    await saveWorkspaceServices(workspaceId, imported.services);

    // Hapus booking lama lalu tulis booking dari file JSON
    for (let i = 0; i < existingBookingIds.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of existingBookingIds.slice(i, i + 400)) {
        batch.delete(doc(db, 'workspaces', workspaceId, 'bookings', id));
      }
      await batch.commit();
    }

    for (let i = 0; i < imported.bookings.length; i += 400) {
      const batch = writeBatch(db);
      for (const b of imported.bookings.slice(i, i + 400)) {
        batch.set(doc(db, 'workspaces', workspaceId, 'bookings', b.booking_id), {
          booking_id: b.booking_id,
          workspace_id: workspaceId,
          owner_uid: ownerUid,
          admin_uids: adminUids,
          therapist_uid: therapistUidByTherapistId.get(b.therapist_id) ?? '',
          patient_name: b.patient_name,
          patient_phone: b.patient_phone,
          service_id: b.service_id,
          therapist_id: b.therapist_id,
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          location_type: b.location_type,
          patient_address: b.patient_address ?? '',
          notes: b.notes ?? '',
          status: b.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetWorkspaceDatabaseInCloud(params: {
  workspaceId: string;
  existingBookingIds: string[];
}): Promise<void> {
  const { workspaceId, existingBookingIds } = params;
  const path = `workspaces/${workspaceId}`;
  try {
    await saveWorkspaceTherapists(workspaceId, DEFAULT_THERAPISTS);
    await saveWorkspaceServices(workspaceId, DEFAULT_SERVICES);
    for (let i = 0; i < existingBookingIds.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of existingBookingIds.slice(i, i + 400)) {
        batch.delete(doc(db, 'workspaces', workspaceId, 'bookings', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
