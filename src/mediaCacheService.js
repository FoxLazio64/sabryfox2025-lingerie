import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

const INDEX_STORAGE_KEY = '@sabryfox_image_db_index_v1';
const CATALOG_CACHE_KEY = '@sabryfox_catalog_cache_v1';
const IMAGES_DIR = `${FileSystem.documentDirectory}sabryfox_full_images/`;
const MIN_CATALOG_ITEMS = 701;

async function ensureImagesDir() {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

async function readImageIndex() {
  try {
    const raw = await AsyncStorage.getItem(INDEX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeImageIndex(indexObj) {
  await AsyncStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(indexObj));
}

function sanitizeFileName(itemId, url) {
  const cleanId = String(itemId || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
  const extMatch = String(url || '').split('?')[0].match(/\.(jpe?g|png|webp)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
  return `${cleanId}${ext}`;
}

export async function isDeviceOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Restituisce una pagina del catalogo per il caricamento progressivo quando si è online.
 * Garantisce almeno 701 prodotti disponibili se il catalogo sorgente li contiene.
 */
export async function loadCatalogPage(allItems, { page = 1, pageSize = 24 } = {}) {
  const sourceList = Array.isArray(allItems) ? allItems : [];
  const boundedList =
    sourceList.length >= MIN_CATALOG_ITEMS
      ? sourceList
      : sourceList;

  const online = await isDeviceOnline();
  if (online && boundedList.length > 0) {
    await AsyncStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), count: boundedList.length })
    );
  }

  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const slice = boundedList.slice(start, end);

  return {
    items: slice,
    page: safePage,
    pageSize,
    totalItems: boundedList.length,
    hasMore: end < boundedList.length,
    isOnline: online,
  };
}

/**
 * Controlla se l'immagine reale è già salvata sul database locale;
 * se non c'è ed è online, la scarica da internet e la salva in locale.
 */
export async function getOrDownloadFullImage(item) {
  const itemId = item?.id || item?.name;
  const remoteUrl = item?.fullImageUrl || (item?.fullImageUrl || item?.imageUrl || item?.thumbnailUrl || item?.image) || item?.image;

  if (!remoteUrl || !String(remoteUrl).startsWith('http')) {
    return { uri: null, fromCache: false, error: 'URL immagine reale non disponibile.' };
  }

  await ensureImagesDir();
  const index = await readImageIndex();
  const entry = index[itemId];

  if (entry?.localUri) {
    const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
    if (fileInfo.exists && fileInfo.size > 0) {
      return { uri: entry.localUri, fromCache: true, error: null };
    }
  }

  const online = await isDeviceOnline();
  if (!online) {
    return {
      uri: null,
      fromCache: false,
      error: 'Sei offline e questa immagine non è ancora stata salvata in locale.',
    };
  }

  const targetUri = `${IMAGES_DIR}${sanitizeFileName(itemId, remoteUrl)}`;
  const downloadRes = await FileSystem.downloadAsync(remoteUrl, targetUri, {
    headers: {
      "User-Agent": "SabryFox2025App/1.0 (https://github.com/FoxLazio64/sabryfox2025-lingerie)",
      "Accept": "image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5"
    }
  });
  if (downloadRes?.uri && downloadRes.status < 400) {
    const savedInfo = await FileSystem.getInfoAsync(downloadRes.uri);
    if (!savedInfo.exists || !savedInfo.size || savedInfo.size < 256) {
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      return {
        uri: null,
        fromCache: false,
        error: "Risposta non valida o file immagine vuoto."
      };
    }
  }

  if (!downloadRes?.uri || downloadRes.status >= 400) {
    return {
      uri: null,
      fromCache: false,
      error: 'Impossibile scaricare l’immagine reale in questo momento.',
    };
  }

  index[itemId] = {
    localUri: downloadRes.uri,
    remoteUrl,
    savedAt: new Date().toISOString(),
  };
  await writeImageIndex(index);

  return { uri: downloadRes.uri, fromCache: false, error: null };
}
