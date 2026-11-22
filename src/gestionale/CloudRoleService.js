import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const OWNER_EMAIL = 'fabio28164@gmail.com';

export const ALLOWED_ROLES = [
  'Amministrazione e Finanze',
  'Dipendenti',
  'Clienti VIP',
];

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

function validateUid(uid) {
  if (
    typeof uid !== 'string' ||
    !uid.trim() ||
    /[.#$/[\]]/.test(uid)
  ) {
    throw new Error('Identificativo Firebase non valido.');
  }

  return uid.trim();
}

export async function submitAccessRequest({ name, requestedRole, note = '' }) {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Effettua prima accesso o registrazione email.');
  }

  if (user.email?.toLowerCase() === OWNER_EMAIL) {
    throw new Error('Il proprietario non invia richieste di ruolo.');
  }

  if (!ALLOWED_ROLES.includes(requestedRole)) {
    throw new Error('Ruolo richiesto non consentito.');
  }

  const cleanName = String(name || '').trim().slice(0, 80);
  if (cleanName.length < 2) {
    throw new Error('Inserisci il tuo nome e cognome.');
  }

  const cleanUid = validateUid(user.uid);
  const payload = {
    requesterUid: cleanUid,
    email: String(user.email || '').trim().toLowerCase(),
    name: cleanName,
    requestedRole,
    note: String(note || '').trim().slice(0, 200),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await database().ref(`accessRequests/${cleanUid}`).set(payload);
  return payload;
}

export async function listAccessRequests() {
  requireOwner();
  const snap = await database().ref('accessRequests').once('value');
  const raw = snap.val() || {};

  return Object.entries(raw).map(([uid, item]) => ({
    uid,
    requesterUid: item?.requesterUid || uid,
    email: item?.email || '',
    name: item?.name || 'Richiedente',
    requestedRole: item?.requestedRole || '',
    note: item?.note || '',
    status: item?.status || 'pending',
    createdAt: item?.createdAt || null,
  }));
}

export async function approveAccessRequest(requesterUid, role) {
  const owner = requireOwner();
  const cleanUid = validateUid(requesterUid);

  if (cleanUid === owner.uid) {
    throw new Error('Il proprietario non può essere registrato con un ruolo subordinato.');
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error('Ruolo non consentito.');
  }

  await database().ref(`roles/${cleanUid}`).set({
    role,
    active: true,
    approvedBy: owner.uid,
    updatedAt: new Date().toISOString(),
  });

  await database().ref(`accessRequests/${cleanUid}`).remove();

  return { uid: cleanUid, role, active: true };
}

export async function rejectAccessRequest(requesterUid) {
  requireOwner();
  const cleanUid = validateUid(requesterUid);
  await database().ref(`accessRequests/${cleanUid}`).remove();
  return { uid: cleanUid, rejected: true };
}

export async function authorizeCloudAccount(uid, role) {
  const owner = requireOwner();
  const cleanUid = validateUid(uid);

  if (cleanUid === owner.uid) {
    throw new Error('Il proprietario non può essere registrato come dipendente.');
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error('Ruolo non consentito.');
  }

  await database().ref(`roles/${cleanUid}`).set({
    role,
    active: true,
  });

  return { uid: cleanUid, role, active: true };
}

export async function revokeCloudAccount(uid) {
  requireOwner();
  const cleanUid = validateUid(uid);
  const ref = database().ref(`roles/${cleanUid}`);
  const snapshot = await ref.once('value');

  if (!snapshot.exists()) {
    throw new Error('Account cloud non trovato tra quelli autorizzati.');
  }

  await ref.update({ active: false });

  return { uid: cleanUid, active: false };
}
