import authDefault, * as FirebaseAuthMod from '@react-native-firebase/auth';
import dbDefault, * as FirebaseDbMod from '@react-native-firebase/database';

const OWNER_EMAIL = 'fabio28164@gmail.com';

export const ALLOWED_ROLES = [
  'Amministrazione e Finanze',
  'Dipendenti',
  'Clienti VIP',
];

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

async function updateVal(path, value) {
  const db = getDbInst();
  if (typeof db.ref === 'function') {
    await db.ref(path).update(value);
    return;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.update === 'function') {
    await FirebaseDbMod.update(FirebaseDbMod.ref(db, path), value);
    return;
  }
  throw new Error('Metodo di aggiornamento database non disponibile.');
}

async function removeVal(path) {
  const db = getDbInst();
  if (typeof db.ref === 'function') {
    await db.ref(path).remove();
    return;
  }
  if (typeof FirebaseDbMod.ref === 'function' && typeof FirebaseDbMod.remove === 'function') {
    await FirebaseDbMod.remove(FirebaseDbMod.ref(db, path));
    return;
  }
  throw new Error('Metodo di rimozione database non disponibile.');
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
  const authInst = getAuthInst();
  const user = authInst.currentUser || null;
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

  await writeVal(`accessRequests/${cleanUid}`, payload);
  return payload;
}

export async function listAccessRequests() {
  requireOwner();
  const raw = (await readOnceVal('accessRequests')) || {};

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

  await writeVal(`roles/${cleanUid}`, {
    role,
    active: true,
    approvedBy: owner.uid,
    updatedAt: new Date().toISOString(),
  });

  await removeVal(`accessRequests/${cleanUid}`);

  return { uid: cleanUid, role, active: true };
}

export async function rejectAccessRequest(requesterUid) {
  requireOwner();
  const cleanUid = validateUid(requesterUid);
  await removeVal(`accessRequests/${cleanUid}`);
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

  await writeVal(`roles/${cleanUid}`, {
    role,
    active: true,
  });

  return { uid: cleanUid, role, active: true };
}

export async function revokeCloudAccount(uid) {
  requireOwner();
  const cleanUid = validateUid(uid);
  const current = await readOnceVal(`roles/${cleanUid}`);

  if (!current || typeof current !== 'object') {
    throw new Error('Account cloud non trovato tra quelli autorizzati.');
  }

  await updateVal(`roles/${cleanUid}`, { active: false });

  return { uid: cleanUid, active: false };
}
