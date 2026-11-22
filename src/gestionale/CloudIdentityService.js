import auth from '@react-native-firebase/auth';

function getAuth() {
  const instance = typeof auth === 'function' ? auth() : auth;
  if (!instance || typeof instance.signInWithEmailAndPassword !== 'function') {
    throw new Error('Servizio di autenticazione non pronto. Riavvia l’app.');
  }
  return instance;
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

export async function registerCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const a = getAuth();

  const credential = await a.createUserWithEmailAndPassword(
    cleanEmail,
    password
  );

  await credential.user.sendEmailVerification();

  return identityOf(credential.user);
}

export async function signInCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);
  const a = getAuth();

  const credential = await a.signInWithEmailAndPassword(
    cleanEmail,
    password
  );

  return identityOf(credential.user);
}

export async function refreshCloudIdentity() {
  const a = getAuth();
  const user = a.currentUser;
  if (!user) return null;

  await user.reload();
  return identityOf(a.currentUser);
}

export async function resendCloudVerification() {
  const a = getAuth();
  const user = a.currentUser;

  if (!user) {
    throw new Error('Nessun account Firebase autenticato.');
  }

  if (!user.emailVerified) {
    await user.sendEmailVerification();
  }

  return identityOf(user);
}

export async function signOutCloudIdentity() {
  const a = getAuth();
  if (a.currentUser) {
    await a.signOut();
  }
}
