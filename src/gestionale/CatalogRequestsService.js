import authDefault, * as FirebaseAuthMod from '@react-native-firebase/auth';
import dbDefault, * as FirebaseDbMod from '@react-native-firebase/database';

const OWNER_EMAIL = 'fabio28164@gmail.com';

function resolveInstance(defaultExport, modNamespace, getterName) {
  const candidates = [
    defaultExport,
    modNamespace && modNamespace.default,
    modNamespace && typeof modNamespace[getterName] === 'function' ? modNamespace[getterName] : null,
  ];

  for (const fn of candidates) {
    if (typeof fn === 'function') {
      try {
        const inst = fn();
        if (inst && typeof inst === 'object') return inst;
      } catch {}
    }
  }

  if (defaultExport && typeof defaultExport === 'object') return defaultExport;
  if (modNamespace && typeof modNamespace === 'object') return modNamespace;
  return null;
}

function getAuthInst() {
  const inst = resolveInstance(authDefault, FirebaseAuthMod, 'getAuth');
  if (!inst) {
    throw new Error('Servizio di autenticazione Firebase non disponibile.');
  }
  return inst;
}

function getDbInst() {
  const inst = resolveInstance(dbDefault, FirebaseDbMod, 'getDatabase');
  if (!inst) {
    throw new Error('Database cloud non disponibile.');
  }
  return inst;
}

function getVerifiedOwnerUid() {
  const authInst = getAuthInst();
  const current = authInst.currentUser;
  if (!current || !current.uid) return null;
  const email = String(current.email || '').trim().toLowerCase();
  if (email !== OWNER_EMAIL || !current.emailVerified) return null;
  return current.uid;
}

async function readOnceVal(path) {
  const db = getDbInst();
  if (typeof db.ref === 'function') {
    const snap = await db.ref(path).once('value');
    return snap && typeof snap.val === 'function' ? snap.val() : null;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.get === 'function') {
    const snap = await FirebaseDbMod.get(FirebaseDbMod.ref(db, path));
    return snap && typeof snap.val === 'function' ? snap.val() : null;
  }
  throw new Error('Metodo di lettura database non disponibile.');
}

async function writeVal(path, value) {
  const db = getDbInst();
  if (typeof db.ref === 'function') {
    await db.ref(path).set(value);
    return;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.set === 'function') {
    await FirebaseDbMod.set(FirebaseDbMod.ref(db, path), value);
    return;
  }
  throw new Error('Metodo di scrittura database non disponibile.');
}

async function runTransactionVal(path, updateFn) {
  const db = getDbInst();
  if (typeof db.ref === 'function') {
    const res = await db.ref(path).transaction((current) => updateFn(current));
    return {
      committed: Boolean(res && res.committed),
      snapshot: res ? res.snapshot : null,
    };
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.runTransaction === 'function') {
    const res = await FirebaseDbMod.runTransaction(
      FirebaseDbMod.ref(db, path),
      (current) => updateFn(current)
    );
    return {
      committed: Boolean(res && res.committed),
      snapshot: res ? res.snapshot : null,
    };
  }
  throw new Error('Metodo di transazione database non disponibile.');
}

export function buildPublicCatalogFromProducts(products = []) {
  if (!Array.isArray(products)) return {};

  const catalog = {};
  for (const item of products) {
    if (!item || !item.id || item.archivedAt) continue;
    const availableQty = Number(item.quantity || 0);
    if (!Number.isFinite(availableQty) || availableQty <= 0) continue;

    const rawPrice = Number(item.salePrice ?? item.price ?? 0);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? Number(rawPrice.toFixed(2)) : 0;

    catalog[String(item.id)] = {
      id: String(item.id),
      code: String(item.code || ''),
      name: String(item.name || ''),
      category: String(item.category || ''),
      size: String(item.size || ''),
      color: String(item.color || ''),
      price,
      availableQty,
      imageUrl: item.imageUrl ? String(item.imageUrl) : null,
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  }

  return catalog;
}

export function applyConfirmedRequestToProducts(products = [], request = null) {
  if (!Array.isArray(products) || !request || !Array.isArray(request.items) || request.items.length === 0) {
    return { ok: false, reason: 'invalid_request', products };
  }

  const nextProducts = products.map((p) => ({ ...p }));
  const now = new Date().toISOString();

  for (const reqItem of request.items) {
    const qty = Number(reqItem?.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, reason: 'invalid_qty', products };
    }

    const idx = nextProducts.findIndex(
      (p) =>
        (reqItem.productId && String(p.id) === String(reqItem.productId)) ||
        (!reqItem.productId && reqItem.code && String(p.code) === String(reqItem.code))
    );

    if (idx === -1) {
      return { ok: false, reason: 'product_not_found', item: reqItem, products };
    }

    const current = nextProducts[idx];
    if (current.archivedAt) {
      return { ok: false, reason: 'product_archived', item: reqItem, products };
    }

    const available = Number(current.quantity || 0);
    if (!Number.isFinite(available) || available < qty) {
      return { ok: false, reason: 'insufficient_stock', item: reqItem, available, requested: qty, products };
    }

    nextProducts[idx] = {
      ...current,
      quantity: available - qty,
      updatedAt: now,
    };
  }

  return { ok: true, products: nextProducts };
}

export async function syncPublicCatalogToCloud(products = []) {
  const uid = getVerifiedOwnerUid();
  if (!uid) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const catalog = buildPublicCatalogFromProducts(products);
  await writeVal('publicCatalog', catalog);
  return { ok: true, count: Object.keys(catalog).length };
}

export async function fetchPendingVisitorRequests() {
  const uid = getVerifiedOwnerUid();
  if (!uid) {
    return [];
  }

  const raw = await readOnceVal('visitorRequests');
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw)
    .map(([id, val]) => ({ id, ...(val || {}) }))
    .filter((req) => req.status === 'pending')
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function setVisitorRequestStatus(requestId, nextStatus) {
  const uid = getVerifiedOwnerUid();
  if (!uid) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (!requestId || !['confirmed', 'cancelled', 'pending'].includes(nextStatus)) {
    return { ok: false, reason: 'invalid_params' };
  }

  const path = `visitorRequests/${requestId}`;
  const res = await runTransactionVal(path, (current) => {
    if (!current || typeof current !== 'object') return current;
    return {
      ...current,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
  });

  return { ok: res.committed, status: nextStatus };
}

export async function confirmVisitorRequestAtomic(requestId, mutateGestionaleStateFn) {
  const uid = getVerifiedOwnerUid();
  if (!uid) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (!requestId || typeof mutateGestionaleStateFn !== 'function') {
    return { ok: false, reason: 'invalid_params' };
  }

  const requestPath = `visitorRequests/${requestId}`;
  let capturedRequest = null;
  let abortCode = null;

  const lockRes = await runTransactionVal(requestPath, (current) => {
    abortCode = null;
    if (!current || typeof current !== 'object') {
      abortCode = 'request_not_found';
      return current;
    }
    if (current.status !== 'pending' || current.stockDeducted === true) {
      abortCode = 'already_processed';
      return current;
    }
    capturedRequest = { id: requestId, ...current };
    return {
      ...current,
      status: 'processing',
      processingAt: new Date().toISOString(),
    };
  });

  if (!lockRes.committed || !capturedRequest) {
    return { ok: false, reason: abortCode || 'lock_failed' };
  }

  let stockResult = null;
  let updatedProducts = null;

  try {
    const mutationRes = await mutateGestionaleStateFn((currentState) => {
      const check = applyConfirmedRequestToProducts(currentState.products || [], capturedRequest);
      stockResult = check;
      if (!check.ok) {
        return undefined;
      }
      updatedProducts = check.products;
      return {
        ...currentState,
        products: check.products,
      };
    });

    if (!mutationRes || !mutationRes.committed || !stockResult || !stockResult.ok) {
      await setVisitorRequestStatus(requestId, 'pending');
      return {
        ok: false,
        reason: stockResult?.reason || mutationRes?.reason || 'stock_mutation_failed',
        detail: stockResult || null,
      };
    }

    await runTransactionVal(requestPath, (current) => {
      if (!current || typeof current !== 'object') return current;
      return {
        ...current,
        status: 'confirmed',
        stockDeducted: true,
        confirmedAt: new Date().toISOString(),
      };
    });

    if (Array.isArray(updatedProducts)) {
      await writeVal('publicCatalog', buildPublicCatalogFromProducts(updatedProducts));
    }

    return { ok: true, requestId, products: updatedProducts };
  } catch (err) {
    await setVisitorRequestStatus(requestId, 'pending');
    return { ok: false, reason: 'exception', error: err?.message || String(err) };
  }
}
