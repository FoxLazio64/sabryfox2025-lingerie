import dbDefault, * as FirebaseDbMod from '@react-native-firebase/database';

function resolveDbInstance() {
  const candidates = [
    dbDefault,
    FirebaseDbMod && FirebaseDbMod.default,
    FirebaseDbMod && typeof FirebaseDbMod.getDatabase === 'function' ? FirebaseDbMod.getDatabase : null,
  ];

  for (const fn of candidates) {
    if (typeof fn === 'function') {
      try {
        const inst = fn();
        if (inst && typeof inst === 'object') return inst;
      } catch {}
    }
  }

  if (dbDefault && typeof dbDefault === 'object') return dbDefault;
  if (FirebaseDbMod && typeof FirebaseDbMod === 'object') return FirebaseDbMod;
  return null;
}

function getDb() {
  const db = resolveDbInstance();
  if (!db) {
    throw new Error('Database cloud non disponibile.');
  }
  return db;
}

async function readOnce(path) {
  const db = getDb();
  if (typeof db.ref === 'function') {
    const snap = await db.ref(path).once('value');
    return snap && typeof snap.val === 'function' ? snap.val() : null;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.get === 'function') {
    const snap = await FirebaseDbMod.get(FirebaseDbMod.ref(db, path));
    return snap && typeof snap.val === 'function' ? snap.val() : null;
  }
  throw new Error('Lettura database non disponibile.');
}

async function pushNew(path, value) {
  const db = getDb();
  if (typeof db.ref === 'function') {
    const newRef = db.ref(path).push();
    await newRef.set(value);
    return newRef.key || null;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.push === 'function' && typeof FirebaseDbMod.set === 'function') {
    const newRef = FirebaseDbMod.push(FirebaseDbMod.ref(db, path));
    await FirebaseDbMod.set(newRef, value);
    return newRef.key || null;
  }
  throw new Error('Scrittura richiesta non disponibile.');
}

export async function fetchPublicCatalog() {
  const raw = await readOnce('publicCatalog');
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw)
    .map(([key, item]) => {
      const data = item && typeof item === 'object' ? item : {};
      const availableQty = Number(data.availableQty ?? data.quantity ?? 0);
      const price = Number(data.price ?? data.salePrice ?? 0);
      return {
        id: String(data.id || key),
        code: String(data.code || ''),
        name: String(data.name || ''),
        category: String(data.category || ''),
        size: String(data.size || ''),
        color: String(data.color || ''),
        price: Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : 0,
        availableQty: Number.isFinite(availableQty) ? availableQty : 0,
        imageUrl: data.imageUrl ? String(data.imageUrl) : null,
        updatedAt: data.updatedAt || '',
      };
    })
    .filter((entry) => entry.id && entry.availableQty > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export async function submitVisitorRequest({ items = [], contactNote = '' } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: 'empty_selection' };
  }

  const normalizedItems = [];
  for (const rawItem of items) {
    const qty = Number(rawItem?.qty || 0);
    const maxQty = Number(rawItem?.availableQty ?? rawItem?.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, reason: 'invalid_qty' };
    }
    if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
      return { ok: false, reason: 'exceeds_available', item: rawItem };
    }

    normalizedItems.push({
      productId: String(rawItem.id || rawItem.productId || ''),
      code: String(rawItem.code || ''),
      name: String(rawItem.name || ''),
      size: String(rawItem.size || ''),
      color: String(rawItem.color || ''),
      qty,
      unitPrice: Number(rawItem.price ?? rawItem.unitPrice ?? 0) || 0,
    });
  }

  const payload = {
    createdAt: Date.now(),
    createdAtIso: new Date().toISOString(),
    status: 'pending',
    stockDeducted: false,
    contactNote: String(contactNote || '').trim().slice(0, 240),
    items: normalizedItems,
  };

  const requestId = await pushNew('visitorRequests', payload);
  return { ok: Boolean(requestId), requestId, payload };
}
