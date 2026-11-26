import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { API_BASE_URL } from '../config';
import { LOCAL_CATALOG } from '../catalog';

function normalizeProducts(raw, sourceLabel) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw.filter(Boolean) : Object.entries(raw).map(([id, val]) => ({
    id,
    ...(val && typeof val === 'object' ? val : { name: String(val) }),
  }));
  return list
    .filter((item) => item && item.active !== false)
    .map((item, idx) => ({
      id: String(item.id || item.code || `${sourceLabel}-${idx}`),
      code: String(item.code || item.id || `SF-${idx + 1}`),
      name: String(item.name || item.title || `Capo ${idx + 1}`),
      category: String(item.category || 'Completi'),
      description: String(item.description || ''),
      price: item.price === null || item.price === undefined || item.price === '' ? null : Number(item.price),
      sizes: Array.isArray(item.sizes) ? item.sizes.filter(Boolean) : [],
      color: String(item.color || ''),
      imageUrl: String(item.imageUrl || item.image || ''),
      sourceCatalog: sourceLabel,
    }));
}

export async function fetchShopCatalog({ includeVip = false } = {}) {
  const combined = [];
  const seen = new Set();

  const addItems = (items) => {
    for (const p of items) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
  };

  try {
    const pubSnap = await database().ref('publicCatalog').once('value');
    addItems(normalizeProducts(pubSnap.val(), 'public'));
  } catch (_) {}

  if (includeVip) {
    try {
      const vipSnap = await database().ref('vipCatalog').once('value');
      addItems(normalizeProducts(vipSnap.val(), 'vip'));
    } catch (_) {}
  }

  if (combined.length === 0 && Array.isArray(LOCAL_CATALOG) && LOCAL_CATALOG.length > 0) {
    addItems(normalizeProducts(LOCAL_CATALOG, 'local'));
  }

  return combined;
}

export async function placeCustomerOrder({ customer, items, note = '' }) {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Devi essere autenticato per inviare un ordine.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Il carrello è vuoto.');
  }

  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const cleanItems = items.map((line) => ({
    productId: String(line.productId || line.id),
    code: String(line.code || ''),
    name: String(line.name),
    size: String(line.size || ''),
    qty: Number(line.qty || 1),
    unitPrice: line.price === null || line.price === undefined || Number.isNaN(Number(line.price))
      ? null
      : Number(line.price),
  }));

  const hasUnpriced = cleanItems.some((i) => i.unitPrice === null);
  const total = hasUnpriced
    ? null
    : Number(cleanItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0).toFixed(2));

  const payload = {
    id: orderId,
    uid: user.uid,
    email: user.email || customer?.email || '',
    customer: {
      name: String(customer?.name || '').trim(),
      email: String(customer?.email || user.email || '').trim(),
      phone: String(customer?.phone || '').trim(),
      address: String(customer?.address || '').trim(),
      city: String(customer?.city || '').trim(),
      postalCode: String(customer?.postalCode || '').trim(),
    },
    items: cleanItems,
    note: String(note || '').trim(),
    total,
    status: 'ricevuto',
    channel: 'app-ecommerce',
    createdAt: new Date().toISOString(),
  };

  await database().ref(`customerOrders/${user.uid}/${orderId}`).set(payload);

  if (API_BASE_URL) {
    try {
      const base = API_BASE_URL.replace(/\/+$/, '');
      await fetch(`${base}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientOrderId: orderId,
          customer: payload.customer,
          items: cleanItems.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            size: i.size,
          })),
          note: payload.note,
          source: 'online',
        }),
      });
    } catch (_) {}
  }

  return payload;
}

export async function fetchMyCustomerOrders() {
  const user = auth().currentUser;
  if (!user) return [];
  const snap = await database().ref(`customerOrders/${user.uid}`).once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val)
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
