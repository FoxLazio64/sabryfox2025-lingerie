const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OFFLINE_SCRIPT = path.join(ROOT, 'scripts', 'build-offline-catalog.js');
const OFFLINE_ARCHIVE = path.join(ROOT, 'offline-archive', 'catalogo-offline.json');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'ecommerceCatalog.json');

// Categorie allineate alle schede e ai filtri dell'e-commerce
const STORE_CATEGORIES = new Set([
  'Reggiseni',
  'Slip',
  'Completi',
  'Body',
  'Lingerie Sexy',
  'Reggicalze e Autoreggenti',
]);

function ensureOfflineSource() {
  if (!fs.existsSync(OFFLINE_ARCHIVE) && fs.existsSync(OFFLINE_SCRIPT)) {
    execFileSync(process.execPath, [OFFLINE_SCRIPT], { stdio: 'inherit' });
  }
  if (!fs.existsSync(OFFLINE_ARCHIVE)) {
    throw new Error('Archivio locale offline-archive/catalogo-offline.json non disponibile');
  }
  const parsed = JSON.parse(fs.readFileSync(OFFLINE_ARCHIVE, 'utf8'));
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function buildPublicCatalog() {
  const sourceItems = ensureOfflineSource();
  const seen = new Set();
  const publicItems = [];

  for (const item of sourceItems) {
    if (!item || typeof item !== 'object') continue;
    const category = String(item.category || '').trim();
    if (!STORE_CATEGORIES.has(category)) continue;

    // Prezzo valido richiesto per la visione e l'acquisto nell'e-commerce
    const numericPrice = item.price === null || item.price === undefined ? NaN : Number(item.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) continue;

    const name = String(item.name || '').trim();
    const brand = String(item.brand || 'SabryFox2025').trim();
    const size = String(item.size || 'Unica').trim();
    const color = String(item.color || 'Nero').trim();
    if (!name) continue;

    const dedupKey = `${brand.toLowerCase()}|${name.toLowerCase()}|${size.toLowerCase()}|${color.toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const index = publicItems.length + 1;
    publicItems.push({
      id: `ec-${String(index).padStart(4, '0')}`,
      sku: `SF-EC-${String(index).padStart(4, '0')}`,
      name,
      brand,
      category,
      size,
      color,
      price: Number(numericPrice.toFixed(2)),
      currency: item.currency || 'EUR',
      inStock: true,
      available: true,
      publishable: true,
      offlineOnly: false,
    });
  }

  if (publicItems.length === 0) {
    throw new Error('Nessun capo valido con prezzo disponibile per il catalogo e-commerce');
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    catalogVersion: '1.0.19-public',
    publishable: true,
    offlineOnly: false,
    totalItems: publicItems.length,
    items: publicItems,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Generati ${publicItems.length} capi pubblicabili in ${path.relative(ROOT, OUT_FILE)} (offline-archive resta privato)`);
}

buildPublicCatalog();
