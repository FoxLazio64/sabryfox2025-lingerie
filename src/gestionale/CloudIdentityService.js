import auth from '@react-native-firebase/auth';

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

async function registerCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);

  const credential = await auth().createUserWithEmailAndPassword(
    cleanEmail,
    password
  );

  await credential.user.sendEmailVerification();

  return identityOf(credential.user);
}

async function signInCloudIdentity(email, password) {
  const cleanEmail = validateCredentials(email, password);

  const credential = await auth().signInWithEmailAndPassword(
    cleanEmail,
    password
  );

  return identityOf(credential.user);
}

async function refreshCloudIdentity() {
  const user = auth().currentUser;
  if (!user) return null;

  await user.reload();
  return identityOf(auth().currentUser);
}

async function resendCloudVerification() {
  const user = auth().currentUser;

  if (!user) {
    throw new Error('Nessun account Firebase autenticato.');
  }

  if (!user.emailVerified) {
    await user.sendEmailVerification();
  }

  return identityOf(user);
}

async function signOutCloudIdentity() {
  await auth().signOut();
}

module.exports = {
  registerCloudIdentity,
  signInCloudIdentity,
  refreshCloudIdentity,
  resendCloudVerification,
  signOutCloudIdentity,
};
