import authDefault, * as FirebaseAuthMod from '@react-native-firebase/auth';
import dbDefault, * as FirebaseDbMod from '@react-native-firebase/database';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const OWNER_EMAIL = 'fabio28164@gmail.com';
const LOCAL_DEVICE_ID_KEY = 'sabryfox_device_id_v1';
const MAX_OWNER_DEVICES = 2;

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

function requireOwner() {
  const authInst = getAuthInst();
  const user = authInst.currentUser || null;

  if (
    !user ||
    user.email?.toLowerCase() !== OWNER_EMAIL ||
    user.emailVerified !== true
  ) {
    throw new Error('Operazione riservata al proprietario con email verificata.');
  }

  return user;
}

function sanitizeKey(value) {
  return String(value || '')
    .trim()
    .replace(/[.#$/[\]\s]+/g, '_')
    .slice(0, 80);
}

export async function getOrCreateLocalDeviceId() {
  const existing = await SecureStore.getItemAsync(LOCAL_DEVICE_ID_KEY);
  if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
    return existing;
  }

  const randomHex = Array.from(Crypto.getRandomBytes(12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const generated = `dev_${Platform.OS}_${randomHex}`;
  await SecureStore.setItemAsync(LOCAL_DEVICE_ID_KEY, generated);
  return generated;
}

export async function listOwnerDevices() {
  requireOwner();
  const raw = (await readOnceVal('ownerDevices')) || {};

  return Object.entries(raw).map(([key, item]) => ({
    key,
    deviceId: item?.deviceId || key,
    label: item?.label || 'Dispositivo senza nome',
    platform: item?.platform || Platform.OS,
    approved: item?.approved === true,
    updatedAt: item?.updatedAt || null,
  }));
}

export async function approveOwnerDevice(deviceId, label = '') {
  const owner = requireOwner();
  const cleanId = sanitizeKey(deviceId);

  if (!cleanId) {
    throw new Error('Identificativo dispositivo non valido.');
  }

  const raw = (await readOnceVal('ownerDevices')) || {};

  const approvedOthers = Object.entries(raw).filter(
    ([key, item]) => key !== cleanId && item?.approved === true
  );

  if (approvedOthers.length >= MAX_OWNER_DEVICES) {
    throw new Error(
      `Limite massimo di ${MAX_OWNER_DEVICES} dispositivi autorizzati raggiunto. Revoca un dispositivo prima di autorizzarne un altro.`
    );
  }

  const record = {
    deviceId: cleanId,
    label: String(label || '').trim().slice(0, 80) || 'Dispositivo autorizzato',
    platform: Platform.OS,
    approved: true,
    ownerUid: owner.uid,
    updatedAt: new Date().toISOString(),
  };

  await writeVal(`ownerDevices/${cleanId}`, record);
  return record;
}

export async function revokeOwnerDevice(deviceId) {
  const owner = requireOwner();
  const cleanId = sanitizeKey(deviceId);

  if (!cleanId) {
    throw new Error('Identificativo dispositivo non valido.');
  }

  const current = await readOnceVal(`ownerDevices/${cleanId}`);
  if (!current || typeof current !== 'object') {
    throw new Error('Dispositivo non trovato nel registro.');
  }

  await writeVal(`ownerDevices/${cleanId}`, {
    ...current,
    deviceId: cleanId,
    approved: false,
    ownerUid: owner.uid,
    updatedAt: new Date().toISOString(),
  });

  return { deviceId: cleanId, approved: false };
}
