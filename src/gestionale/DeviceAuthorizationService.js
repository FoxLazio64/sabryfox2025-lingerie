import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const OWNER_EMAIL = 'fabio28164@gmail.com';
const LOCAL_DEVICE_ID_KEY = 'sabryfox_device_id_v1';
const MAX_OWNER_DEVICES = 2;

function requireOwner() {
  const user = auth().currentUser;

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
  const snap = await database().ref('ownerDevices').once('value');
  const raw = snap.val() || {};

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

  const ref = database().ref('ownerDevices');
  const snap = await ref.once('value');
  const raw = snap.val() || {};

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

  await ref.child(cleanId).set(record);
  return record;
}

export async function revokeOwnerDevice(deviceId) {
  const owner = requireOwner();
  const cleanId = sanitizeKey(deviceId);

  if (!cleanId) {
    throw new Error('Identificativo dispositivo non valido.');
  }

  const ref = database().ref(`ownerDevices/${cleanId}`);
  const snap = await ref.once('value');

  if (!snap.exists()) {
    throw new Error('Dispositivo non trovato nel registro.');
  }

  const current = snap.val() || {};
  await ref.set({
    ...current,
    deviceId: cleanId,
    approved: false,
    ownerUid: owner.uid,
    updatedAt: new Date().toISOString(),
  });

  return { deviceId: cleanId, approved: false };
}
