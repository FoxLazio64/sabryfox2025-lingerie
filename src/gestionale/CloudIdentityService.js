import authDefault, * as FirebaseAuthMod from '@react-native-firebase/auth';

function getAuthInstance() {
  const candidates = [
    authDefault,
    FirebaseAuthMod && FirebaseAuthMod.default,
    FirebaseAuthMod && typeof FirebaseAuthMod.getAuth === 'function' ? FirebaseAuthMod.getAuth : null,
  ];

  for (const fn of candidates) {
    if (typeof fn === 'function') {
      try {
        const inst = fn();
        if (inst && typeof inst === 'object') return inst;
      } catch {}
    }
  }

  if (authDefault && typeof authDefault === 'object' && typeof authDefault.signInWithEmailAndPassword === 'function') {
    return authDefault;
  }

  if (FirebaseAuthMod && typeof FirebaseAuthMod === 'object' && typeof FirebaseAuthMod.signInWithEmailAndPassword === 'function') {
    return FirebaseAuthMod;
  }

  throw new Error('Servizio di autenticazione Firebase non disponibile su questo dispositivo.');
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
    const inst = getAuthInstance();
    return inst.currentUser || null;
  } catch {
    return null;
  }
}

export async function registerCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const inst = getAuthInstance();

  if (typeof inst.createUserWithEmailAndPassword === 'function') {
    const credential = await inst.createUserWithEmailAndPassword(cleanEmail, password);
    if (credential && credential.user && typeof credential.user.sendEmailVerification === 'function') {
      await credential.user.sendEmailVerification();
    }
    return identityOf(credential && credential.user);
  }

  if (typeof FirebaseAuthMod.createUserWithEmailAndPassword === 'function') {
    const credential = await FirebaseAuthMod.createUserWithEmailAndPassword(inst, cleanEmail, password);
    if (credential && credential.user && typeof FirebaseAuthMod.sendEmailVerification === 'function') {
      await FirebaseAuthMod.sendEmailVerification(credential.user);
    }
    return identityOf(credential && credential.user);
  }

  throw new Error('Metodo di registrazione Firebase non disponibile.');
}

export async function signInCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const inst = getAuthInstance();

  if (typeof inst.signInWithEmailAndPassword === 'function') {
    const credential = await inst.signInWithEmailAndPassword(cleanEmail, password);
    return identityOf(credential && credential.user);
  }

  if (typeof FirebaseAuthMod.signInWithEmailAndPassword === 'function') {
    const credential = await FirebaseAuthMod.signInWithEmailAndPassword(inst, cleanEmail, password);
    return identityOf(credential && credential.user);
  }

  throw new Error('Metodo di accesso Firebase non disponibile.');
}

export async function refreshCloudIdentity() {
  const inst = getAuthInstance();
  const user = inst.currentUser;
  if (!user) return null;

  if (typeof user.reload === 'function') {
    await user.reload();
  } else if (typeof FirebaseAuthMod.reload === 'function') {
    await FirebaseAuthMod.reload(user);
  }
  return identityOf(inst.currentUser);
}

export async function resendCloudVerification() {
  const inst = getAuthInstance();
  const user = inst.currentUser;

  if (!user) {
    throw new Error('Nessun account Firebase autenticato.');
  }

  if (!user.emailVerified) {
    if (typeof user.sendEmailVerification === 'function') {
      await user.sendEmailVerification();
    } else if (typeof FirebaseAuthMod.sendEmailVerification === 'function') {
      await FirebaseAuthMod.sendEmailVerification(user);
    }
  }

  return identityOf(user);
}

export async function signOutCloudIdentity() {
  const inst = getAuthInstance();
  if (inst && inst.currentUser) {
    if (typeof inst.signOut === 'function') {
      await inst.signOut();
    } else if (typeof FirebaseAuthMod.signOut === 'function') {
      await FirebaseAuthMod.signOut(inst);
    }
  }
}
