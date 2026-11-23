import * as FirebaseAuthMod from '@react-native-firebase/auth';

function resolveAuth() {
  const mod = FirebaseAuthMod.default || FirebaseAuthMod;
  if (typeof mod === 'function') {
    const inst = mod();
    if (inst) return { mode: 'namespaced', inst };
  }
  if (mod && typeof mod.signInWithEmailAndPassword === 'function') {
    return { mode: 'namespaced', inst: mod };
  }
  if (typeof FirebaseAuthMod.getAuth === 'function') {
    const inst = FirebaseAuthMod.getAuth();
    if (inst) return { mode: 'modular', inst };
  }
  throw new Error('Modulo Firebase Auth non inizializzato nella build Android.');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateCredentials(email, password) {
  const cleanEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Indirizzo email non valido.');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('La password Firebase deve contenere almeno 8 caratteri.');
  }

  return cleanEmail;
}

function identityOf(user) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email || null,
    emailVerified: user.emailVerified === true,
  };
}

export function getCurrentCloudUser() {
  try {
    const { inst } = resolveAuth();
    return inst.currentUser || null;
  } catch {
    return null;
  }
}

export async function registerCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const { mode, inst } = resolveAuth();

  const credential = mode === 'modular'
    ? await FirebaseAuthMod.createUserWithEmailAndPassword(inst, cleanEmail, password)
    : await inst.createUserWithEmailAndPassword(cleanEmail, password);

  if (mode === 'modular' && typeof FirebaseAuthMod.sendEmailVerification === 'function') {
    await FirebaseAuthMod.sendEmailVerification(credential.user);
  } else if (typeof credential.user.sendEmailVerification === 'function') {
    await credential.user.sendEmailVerification();
  }

  return identityOf(credential.user);
}

export async function signInCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const { mode, inst } = resolveAuth();

  const credential = mode === 'modular'
    ? await FirebaseAuthMod.signInWithEmailAndPassword(inst, cleanEmail, password)
    : await inst.signInWithEmailAndPassword(cleanEmail, password);

  return identityOf(credential.user);
}

export async function refreshCloudIdentity() {
  const { mode, inst } = resolveAuth();
  const user = inst.currentUser;
  if (!user) return null;

  if (mode === 'modular' && typeof FirebaseAuthMod.reload === 'function') {
    await FirebaseAuthMod.reload(user);
  } else if (typeof user.reload === 'function') {
    await user.reload();
  }
  return identityOf(inst.currentUser);
}

export async function resendCloudVerification() {
  const { mode, inst } = resolveAuth();
  const user = inst.currentUser;

  if (!user) {
    throw new Error('Nessun account Firebase autenticato.');
  }

  if (!user.emailVerified) {
    if (mode === 'modular' && typeof FirebaseAuthMod.sendEmailVerification === 'function') {
      await FirebaseAuthMod.sendEmailVerification(user);
    } else if (typeof user.sendEmailVerification === 'function') {
      await user.sendEmailVerification();
    }
  }

  return identityOf(user);
}

export async function signOutCloudIdentity() {
  const { mode, inst } = resolveAuth();
  if (inst.currentUser) {
    if (mode === 'modular' && typeof FirebaseAuthMod.signOut === 'function') {
      await FirebaseAuthMod.signOut(inst);
    } else if (typeof inst.signOut === 'function') {
      await inst.signOut();
    }
  }
}
