// Pengujian verifikasi aturan keamanan Firestore (Eight Pillars) dan sanitasi payload blueprint (Dirty Dozen).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildBookingPayload,
  buildProductPayload,
  buildProductSalePayload,
  buildServicePayload,
  buildTherapistPayload,
  buildWorkspacePayload,
  isValidBlueprintId,
  sanitizePhone,
} from './src/lib/firestoreSchema';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, { required: string[]; properties: Record<string, unknown> }>;
  firestore: Record<string, unknown>;
};

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
}

// 1. Default-deny safety net
check('Rules start with default-deny catch-all', () => {
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

// 2. All blueprint paths are matched in firestore.rules
check('Every collection in firebase-blueprint.json has a match block', () => {
  const expectedMatchers = [
    'match /workspaces/{workspaceId}',
    'match /therapists/{therapistId}',
    'match /services/{serviceId}',
    'match /products/{productId}',
    'match /bookings/{bookingId}',
    'match /product_sales/{saleId}',
    'match /admins/{uid}',
    'match /test/connection',
  ];
  for (const m of expectedMatchers) {
    assert.ok(rulesText.includes(m), `Missing rules match block: ${m}`);
  }
});

// 3. Email spoofing prevention & verification check
check('Rules require email_verified == true for writes and bootstrapped admin', () => {
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes("isVerifiedSignedIn() && request.auth.token.email == 'mailtoghofur@gmail.com'"));
});

// 4. Standalone validation helpers present and enforced on create & update
check('Every entity has standalone isValid* helper enforced on create and update', () => {
  const helpers = [
    'isValidWorkspace',
    'isValidTherapist',
    'isValidService',
    'isValidProduct',
    'isValidBooking',
    'isValidProductSale',
  ];
  for (const helper of helpers) {
    const matches = rulesText.match(new RegExp(helper, 'g')) ?? [];
    assert.ok(matches.length >= 3, `${helper} must be defined and called on create and update`);
  }
});

// 5. Query Enforcer: zero get()/exists() inside allow list lines
check('allow list rules evaluate existing().ownerId without get() or exists()', () => {
  const listLines = rulesText
    .split('\n')
    .filter((line) => line.trim().startsWith('allow list:'));
  assert.ok(listLines.length >= 6);
  for (const line of listLines) {
    assert.ok(!line.includes('get(') && !line.includes('exists('), `Unsafe DB read in allow list: ${line}`);
    assert.ok(
      line.includes('existing().ownerId == request.auth.uid') || line.includes('isBootstrappedAdmin()'),
      `allow list must enforce ownership: ${line}`
    );
  }
});

// 6. Temporal & immutable constraints + affectedKeys().hasOnly()
check('Temporal request.time and affectedKeys().hasOnly() checks present', () => {
  assert.ok(rulesText.includes('incoming().createdAt == request.time'));
  assert.ok(rulesText.includes('incoming().updatedAt == request.time'));
  assert.ok(rulesText.includes('incoming().createdAt == existing().createdAt'));
  assert.ok(rulesText.includes('affectedKeys().hasOnly('));
});

// 7. Dirty Dozen schema synchronicity & payload sanitization tests
check('Shadow fields and oversized IDs are rejected/sanitized cleanly', () => {
  const uid = 'user_abc_123';
  const ws = buildWorkspacePayload({
    uid,
    clinicName: 'A'.repeat(250),
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
  });
  assert.equal(ws.clinicName.length, 100);
  assert.deepEqual(Object.keys(ws).sort(), [
    'clinicName',
    'ownerEmail',
    'ownerId',
    'ownerName',
    'workspaceId',
  ]);
  assert.equal(isValidBlueprintId('bad..id/123'), false);
  assert.equal(isValidBlueprintId('valid_ID-01'), true);
});

check('Booking payload matches exact blueprint keys and bounds', () => {
  const uid = 'uid_clinic_1';
  const payload = buildBookingPayload(uid, uid, {
    booking_id: 'B$999',
    patient_name: 'Nadia '.repeat(40),
    patient_phone: '0812-3456-7890',
    service_id: 'S-01',
    therapist_id: 'T-01',
    booking_date: '2026-11-21',
    start_time: '10:00',
    end_time: '11:00',
    location_type: 'CLINIC',
    patient_address: '',
    notes: 'Catatan',
    status: 'COMPLETED',
    is_loyalty_reward: false,
    discount_percent: 20,
    discount_amount: 30000,
    final_price: 120000,
    created_at: '2026-11-21T10:00:00.000Z',
    updated_at: '2026-11-21T10:00:00.000Z',
  });

  assert.match(payload.booking_id, /^[a-zA-Z0-9_-]+$/);
  assert.equal(payload.patient_name.length, 120);
  assert.equal(payload.patient_phone, '081234567890');
  assert.equal(sanitizePhone('abc'), '000000');

  const blueprintBookingKeys = Object.keys(blueprint.entities.Booking.properties).filter(
    (k) => k !== 'createdAt' && k !== 'updatedAt'
  );
  assert.deepEqual(Object.keys(payload).sort(), blueprintBookingKeys.sort());
});

check('Therapist, Service, Product, and ProductSale payloads match exact blueprint keys', () => {
  const uid = 'uid_clinic_1';
  const t = buildTherapistPayload(uid, uid, {
    therapist_id: 'T-01',
    name: 'Sari',
    is_active: true,
  });
  const s = buildServicePayload(uid, uid, {
    service_id: 'S-01',
    category: 'PIJAT',
    service_name: 'Pijat Relaksasi',
    duration_minutes: 60,
    price: 150000,
    allow_home_service: true,
  });
  const p = buildProductPayload(uid, uid, {
    product_id: 'P-01',
    product_name: 'Serum',
    price: 120000,
    is_active: true,
  });
  const ps = buildProductSalePayload(uid, uid, {
    sale_id: 'SALE-01',
    product_id: 'P-01',
    product_name: 'Serum',
    therapist_id: 'T-01',
    buyer_name: 'Rani',
    quantity: 2,
    unit_price: 120000,
    total_amount: 240000,
    sale_date: '2026-11-21',
    notes: '',
    status: 'COMPLETED',
    created_at: '2026-11-21T10:00:00.000Z',
    updated_at: '2026-11-21T10:00:00.000Z',
  });

  assert.deepEqual(
    Object.keys(t).sort(),
    Object.keys(blueprint.entities.Therapist.properties)
      .filter((k) => k !== 'createdAt' && k !== 'updatedAt')
      .sort()
  );
  assert.deepEqual(
    Object.keys(s).sort(),
    Object.keys(blueprint.entities.Service.properties)
      .filter((k) => k !== 'createdAt' && k !== 'updatedAt')
      .sort()
  );
  assert.deepEqual(
    Object.keys(p).sort(),
    Object.keys(blueprint.entities.Product.properties)
      .filter((k) => k !== 'createdAt' && k !== 'updatedAt')
      .sort()
  );
  assert.deepEqual(
    Object.keys(ps).sort(),
    Object.keys(blueprint.entities.ProductSale.properties)
      .filter((k) => k !== 'createdAt' && k !== 'updatedAt')
      .sort()
  );
});

console.log(`PASSED: ${passed} / ${passed}`);
