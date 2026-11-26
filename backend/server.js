'use strict';

// Backend REST essenziale per il prototipo SabryFox2025.
// Prima della vendita pubblica va distribuito dietro HTTPS e sottoposto a revisione di sicurezza.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const ENV_FILE = path.join(ROOT, '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !Object.prototype.hasOwnProperty.call(process.env, match[1])) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnv();

const PORT = Number(process.env.PORT || 8080);
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const STAFF_ROLES = new Set(['amministratore-unico', 'amministrazione-finanze', 'dipendente']);
const OWNER_ROLE = 'amministratore-unico';
const ALLOWED_ORDER_STATES = new Set(['ricevuto', 'in_preparazione', 'spedito', 'completato', 'annullato']);

fs.mkdirSync(DATA_DIR, { recursive: true });

function freshStore() {
  return {
    users: [],
    products: JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')),
    orders: [],
  };
}

function loadStore() {
  if (!fs.existsSync(STORE_FILE)) {
    const store = freshStore();
    saveStore(store);
    return store;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      products: Array.isArray(parsed.products) ? parsed.products : freshStore().products,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch (error) {
    throw new Error(`Archivio dati non leggibile (${error.message}). Non sovrascrivo il file danneggiato.`);
  }
}

function saveStore(store) {
  const temporary = `${STORE_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, STORE_FILE);
}

let store = loadStore();

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function checkPassword(password, user) {
  const actual = crypto.scryptSync(String(password), user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function findUserFromToken(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2 || !TOKEN_SECRET) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0]).digest();
  let supplied;
  try { supplied = Buffer.from(parts[1], 'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return store.users.find(user => user.id === payload.sub) || null;
  } catch {
    return null;
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error('Richiesta troppo grande.'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('JSON non valido.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function requireAuth(req, res, roles = null) {
  const user = findUserFromToken(req.headers.authorization);
  if (!user) {
    json(res, 401, { message: 'Accesso non valido o scaduto.' });
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    json(res, 403, { message: 'Non hai i permessi per questa operazione.' });
    return null;
  }
  return user;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function seedOwner() {
  const email = emailKey(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.warn('ATTENZIONE: ADMIN_EMAIL/ADMIN_PASSWORD non configurati; nessun account titolare iniziale creato.');
    return;
  }
  if (password.length < 14) {
    console.warn('ATTENZIONE: ADMIN_PASSWORD deve contenere almeno 14 caratteri; account titolare non creato.');
    return;
  }
  if (store.users.some(user => user.email === email)) return;
  const credentials = hashPassword(password);
  store.users.push({
    id: crypto.randomUUID(),
    name: cleanText(process.env.ADMIN_NAME || 'Amministratore unico', 100),
    email,
    role: OWNER_ROLE,
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
    createdAt: new Date().toISOString(),
  });
  saveStore(store);
  console.log(`Account Amministratore unico inizializzato: ${email}`);
}
seedOwner();

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'SabryFox2025 Store API', timestamp: new Date().toISOString(), onlinePaymentsEnabled: false });
  }

  if (req.method === 'GET' && pathname === '/api/catalog') {
    return json(res, 200, { products: store.products.filter(product => product.active !== false) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await readBody(req);
    const name = cleanText(body.name, 100);
    const email = emailKey(body.email);
    const password = String(body.password || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
      return json(res, 400, { message: 'Inserisci nome, e-mail valida e password di almeno 10 caratteri.' });
    }
    if (store.users.some(user => user.email === email)) return json(res, 409, { message: 'Esiste già un account con questa e-mail.' });
    const credentials = hashPassword(password);
    const user = { id: crypto.randomUUID(), name, email, role: 'cliente', passwordSalt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date().toISOString() };
    store.users.push(user);
    saveStore(store);
    return json(res, 201, { token: makeToken(user), user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(req);
    const email = emailKey(body.email);
    const user = store.users.find(item => item.email === email);
    if (!user || !checkPassword(body.password || '', user)) return json(res, 401, { message: 'E-mail o password non corretti.' });
    return json(res, 200, { token: makeToken(user), user: publicUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/orders') {
    const body = await readBody(req);
    const customer = body.customer || {};
    const name = cleanText(customer.name, 120);
    const email = emailKey(customer.email);
    const phone = cleanText(customer.phone, 40);
    const address = cleanText(customer.address, 180);
    const city = cleanText(customer.city, 100);
    const postalCode = cleanText(customer.postalCode, 16);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone || !address || !city || !postalCode) {
      return json(res, 400, { message: 'I dati del cliente o di consegna sono incompleti.' });
    }
    const inputItems = Array.isArray(body.items) ? body.items : [];
    if (!inputItems.length || inputItems.length > 40) return json(res, 400, { message: 'Il carrello è vuoto o contiene troppe righe.' });
    const clientOrderId = cleanText(body.clientOrderId, 80) || null;
    if (clientOrderId) {
      const duplicate = store.orders.find(order => order.clientOrderId === clientOrderId);
      if (duplicate) return json(res, 200, { order: duplicate, duplicate: true });
    }
    const items = [];
    let total = 0;
    let hasUnpriced = false;
    for (const line of inputItems) {
      const product = store.products.find(item => item.id === String(line.productId) && item.active !== false);
      const qty = Number(line.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) return json(res, 400, { message: 'Una riga del carrello non è valida o il prodotto non è più disponibile.' });
      if (product.stock !== null && product.stock !== undefined && Number(product.stock) < qty) return json(res, 409, { message: `Disponibilità insufficiente per ${product.name}.` });
      const unitPrice = product.price === null || product.price === undefined ? null : Number(product.price);
      if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice <= 0) hasUnpriced = true;
      else total += unitPrice * qty;
      items.push({ productId: product.id, name: product.name, qty, size: cleanText(line.size || '', 20), unitPrice });
    }
    const order = {
      id: `SFO-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      clientOrderId,
      userId: findUserFromToken(req.headers.authorization)?.id || null,
      customer: { name, email, phone, address, city, postalCode },
      items,
      note: cleanText(body.note, 1000),
      total: hasUnpriced ? null : Number(total.toFixed(2)),
      source: body.source === 'offline' ? 'offline' : 'online',
      status: 'ricevuto',
      createdAt: new Date().toISOString(),
    };
    store.orders.unshift(order);
    saveStore(store);
    return json(res, 201, { order });
  }

  if (req.method === 'GET' && pathname === '/api/my-orders') {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { orders: store.orders.filter(order => order.userId === user.id || order.customer.email === user.email) });
  }

  if (req.method === 'GET' && pathname === '/api/admin/orders') {
    const user = requireAuth(req, res, [...STAFF_ROLES]);
    if (!user) return;
    return json(res, 200, { orders: store.orders });
  }

  const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && orderStatusMatch) {
    const user = requireAuth(req, res, [...STAFF_ROLES]);
    if (!user) return;
    const body = await readBody(req);
    const status = String(body.status || '');
    if (!ALLOWED_ORDER_STATES.has(status)) return json(res, 400, { message: 'Stato ordine non riconosciuto.' });
    const order = store.orders.find(item => item.id === decodeURIComponent(orderStatusMatch[1]));
    if (!order) return json(res, 404, { message: 'Ordine non trovato.' });
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.updatedBy = user.id;
    saveStore(store);
    return json(res, 200, { order });
  }

  if (req.method === 'POST' && pathname === '/api/admin/products') {
    const user = requireAuth(req, res, [OWNER_ROLE]);
    if (!user) return;
    const body = await readBody(req);
    const name = cleanText(body.name, 120);
    const category = cleanText(body.category, 40);
    const description = cleanText(body.description, 1200);
    const price = Number(body.price);
    const stock = body.stock === null || body.stock === undefined || body.stock === '' ? null : Number(body.stock);
    if (!name || !category || !description || !Number.isFinite(price) || price <= 0 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
      return json(res, 400, { message: 'Nome, categoria, descrizione, prezzo e giacenza non sono validi.' });
    }
    const product = {
      id: `sf-${crypto.randomBytes(4).toString('hex')}`,
      name, category, description, price: Number(price.toFixed(2)), stock,
      active: body.active !== false,
      sizes: Array.isArray(body.sizes) ? body.sizes.map(x => cleanText(x, 12)).filter(Boolean).slice(0, 20) : [],
      color: cleanText(body.color || '', 40),
      imageUrl: cleanText(body.imageUrl || '', 500),
      symbol: '✦',
      createdAt: new Date().toISOString(),
    };
    store.products.unshift(product);
    saveStore(store);
    return json(res, 201, { product });
  }

  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (req.method === 'PATCH' && productMatch) {
    const user = requireAuth(req, res, [OWNER_ROLE]);
    if (!user) return;
    const body = await readBody(req);
    const product = store.products.find(item => item.id === decodeURIComponent(productMatch[1]));
    if (!product) return json(res, 404, { message: 'Prodotto non trovato.' });
    for (const key of ['name', 'category', 'description', 'color', 'imageUrl']) {
      if (body[key] !== undefined) product[key] = cleanText(body[key], key === 'description' ? 1200 : 500);
    }
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) return json(res, 400, { message: 'Prezzo non valido.' });
      product.price = Number(price.toFixed(2));
    }
    if (body.stock !== undefined) {
      const stock = body.stock === null ? null : Number(body.stock);
      if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return json(res, 400, { message: 'Giacenza non valida.' });
      product.stock = stock;
    }
    if (body.active !== undefined) product.active = Boolean(body.active);
    if (Array.isArray(body.sizes)) product.sizes = body.sizes.map(x => cleanText(x, 12)).filter(Boolean).slice(0, 20);
    product.updatedAt = new Date().toISOString();
    saveStore(store);
    return json(res, 200, { product });
  }

  if (req.method === 'POST' && pathname === '/api/admin/staff') {
    const user = requireAuth(req, res, [OWNER_ROLE]);
    if (!user) return;
    const body = await readBody(req);
    const name = cleanText(body.name, 100);
    const email = emailKey(body.email);
    const password = String(body.password || '');
    const role = String(body.role || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !['amministrazione-finanze', 'dipendente'].includes(role)) {
      return json(res, 400, { message: 'Dati non validi. Sono ammessi solo i ruoli Amministrazione e Finanze oppure Dipendente.' });
    }
    if (store.users.some(item => item.email === email)) return json(res, 409, { message: 'Esiste già un account con questa e-mail.' });
    const credentials = hashPassword(password);
    const newUser = { id: crypto.randomUUID(), name, email, role, passwordSalt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date().toISOString() };
    store.users.push(newUser);
    saveStore(store);
    return json(res, 201, { user: publicUser(newUser) });
  }

  if (req.method === 'GET' && pathname === '/api/admin/summary') {
    const user = requireAuth(req, res, [...STAFF_ROLES]);
    if (!user) return;
    const pricedOrders = store.orders.filter(order => typeof order.total === 'number');
    const revenue = pricedOrders.reduce((sum, order) => sum + order.total, 0);
    return json(res, 200, { orders: store.orders.length, pending: store.orders.filter(order => !['completato', 'annullato'].includes(order.status)).length, revenue: Number(revenue.toFixed(2)) });
  }

  if (req.method === 'GET' && pathname === '/api/payments/status') {
    return json(res, 200, { provider: process.env.PAYMENT_PROVIDER || null, onlinePaymentEnabled: false, message: 'Il gateway di pagamento deve essere configurato e verificato dal titolare prima di accettare pagamenti online.' });
  }

  return json(res, 404, { message: 'Endpoint non trovato.' });
}

if (process.env.NODE_ENV === 'production' && (!TOKEN_SECRET || TOKEN_SECRET.length < 32)) {
  console.error('TOKEN_SECRET deve contenere almeno 32 caratteri in produzione.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error('Errore API:', error);
    if (!res.headersSent) json(res, error.statusCode || 500, { message: error.statusCode ? error.message : 'Errore interno del servizio.' });
    else res.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SabryFox2025 Store API in ascolto sulla porta ${PORT}`);
  if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) console.warn('ATTENZIONE: imposta TOKEN_SECRET con almeno 32 caratteri casuali prima dell’uso pubblico.');
  console.log('Catalogo:', store.products.length, 'prodotti · Ordini:', store.orders.length, '· Utenti:', store.users.length);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
