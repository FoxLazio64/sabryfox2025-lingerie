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

function getVerifiedOwnerUid() {
  const authInst = getAuthInst();
  const current = authInst.currentUser;
  if (!current || !current.uid) return null;
  const email = String(current.email || '').trim().toLowerCase();
  if (email !== OWNER_EMAIL || !current.emailVerified) return null;
  return current.uid;
}

function isValidGestionaleState(state) {
  return Boolean(
    state &&
    typeof state === 'object' &&
    Array.isArray(state.products) &&
    Array.isArray(state.movements) &&
    Array.isArray(state.finance) &&
    Array.isArray(state.orders)
  );
}

export async function pullGestionaleStateFromCloud() {
  const uid = getVerifiedOwnerUid();
  if (!uid) return null;

  const remote = await readOnceVal(`ownerWorkspace/${uid}/gestionaleState`);
  if (!isValidGestionaleState(remote)) return null;

  return {
    version: 1,
    updatedAt: remote.updatedAt || new Date(0).toISOString(),
    products: remote.products,
    movements: remote.movements,
    finance: remote.finance,
    orders: remote.orders,
  };
}

export async function pushGestionaleStateToCloud(state) {
  const uid = getVerifiedOwnerUid();
  if (!uid) return false;
  if (!isValidGestionaleState(state)) return false;

  const payload = {
    version: 1,
    updatedAt: state.updatedAt || new Date().toISOString(),
    products: state.products,
    movements: state.movements,
    finance: state.finance,
    orders: state.orders,
  };

  await writeVal(`ownerWorkspace/${uid}/gestionaleState`, payload);
  return true;
}
