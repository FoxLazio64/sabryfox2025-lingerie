import React, { useEffect, useState } from 'react';
import {
  Alert, Clipboard, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FirebaseDbMod from '@react-native-firebase/database';
import {
  registerCloudIdentity,
  signInCloudIdentity,
  refreshCloudIdentity,
  resendCloudVerification,
  getCurrentCloudUser,
  signOutCloudIdentity,
} from './CloudIdentityService';
import {
  ALLOWED_ROLES,
  submitAccessRequest,
} from './CloudRoleService';
import { getOrCreateLocalDeviceId } from './DeviceAuthorizationService';

const OWNER_EMAIL = 'fabio28164@gmail.com';
const KEY = 'sabryfox_accounts_v1';

function makeSalt() {
  return Array.from(Crypto.getRandomBytes(16))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + ':' + password
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[s.input, secureTextEntry && { paddingRight: 52 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A858B"
          secureTextEntry={!!secureTextEntry && !visible}
          autoCapitalize="none"
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisible(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Nascondi password' : 'Mostra password'}
            style={{
              position: 'absolute',
              right: 10,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ fontSize: 20 }}>{visible ? '🙈' : '👁️'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Button({ title, onPress, secondary }) {
  return (
    <Pressable
      style={[s.button, secondary && s.secondary]}
      onPress={onPress}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function AuthGate({ children }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('blocked');
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [cloudTab, setCloudTab] = useState('signin');
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqRole, setReqRole] = useState(ALLOWED_ROLES[1]);
  const [reqNote, setReqNote] = useState('');
  const [cloudStatus, setCloudStatus] = useState('');
  const [hasCloudUser, setHasCloudUser] = useState(false);
  const [isCloudEmailVerified, setIsCloudEmailVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const localDevId = await getOrCreateLocalDeviceId();
        if (active) setDeviceId(localDevId);

        const raw = await SecureStore.getItemAsync(KEY);
        const saved = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(saved)) throw new Error('Archivio non valido');

        const normalized = saved.map((u) => ({
          ...u,
          role: u.isOwner || u.role === 'Amministratore'
            ? 'Amministratore unico'
            : u.role === 'Amministrazione'
              ? 'Amministrazione e Finanze'
              : u.role === 'Dipendente'
                ? 'Dipendenti'
                : ['Cliente', 'Cliente VIP', 'Clienti'].includes(u.role)
                  ? 'Clienti VIP'
                  : u.role,
        }));

        const owners = normalized.filter(
          (u) => u.role === 'Amministratore unico' || u.isOwner
        );

        if (owners.length > 1) {
          throw new Error('Sono presenti più amministratori locali. Pulizia annullata.');
        }

        if (active) {
          if (JSON.stringify(normalized) !== JSON.stringify(saved)) {
            await SecureStore.setItemAsync(KEY, JSON.stringify(normalized));
          }
          setUsers(normalized);
          setMode('login');
        }
      } catch (error) {
        if (active) setStorageError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, []);

  const saveUsers = async (next) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    setUsers(next);
  };

  const createOrResetLocalOwner = async () => {
    const cleanUser = (loginUsername || 'sabrifox2025').trim().toLowerCase();
    if (!cleanUser) {
      return Alert.alert('Nome utente mancante', 'Inserisci il nome utente (es. sabrifox2025).');
    }
    if (typeof loginPassword !== 'string' || loginPassword.length < 4) {
      return Alert.alert('Password troppo corta', 'Inserisci una password di almeno 4 caratteri.');
    }
    try {
      const salt = makeSalt();
      const passwordHash = await hashPassword(loginPassword, salt);
      const existing = users.find((u) => u.username === cleanUser);
      const account = existing
        ? { ...existing, salt, passwordHash, role: existing.role || 'Amministratore unico' }
        : {
            id: 'local-' + Date.now(),
            name: 'Amministratore Unico',
            username: cleanUser,
            role: 'Amministratore unico',
            isOwner: true,
            salt,
            passwordHash,
          };
      const nextUsers = existing
        ? users.map((u) => (u.username === cleanUser ? account : u))
        : [...users, account];
      await saveUsers(nextUsers);
      setSession({
        id: account.id,
        name: account.name,
        username: account.username,
        role: account.role,
      });
      setLoginPassword('');
    } catch {
      Alert.alert('Errore', 'Impossibile salvare l\'account locale.');
    }
  };

  const login = async () => {
    const cleanUser = loginUsername.trim().toLowerCase();
    if (!cleanUser || !loginPassword) {
      return Alert.alert('Dati mancanti', 'Inserisci nome utente e password.');
    }

    if (users.length === 0) {
      return createOrResetLocalOwner();
    }

    const found = users.find((u) => u.username === cleanUser);

    if (!found) {
      return Alert.alert(
        'Utente non trovato',
        `L'utente "${cleanUser}" non è ancora salvato su questo tablet. Tocca "SALVA / AGGIORNA ACCESSO LOCALE" qui sotto per registrarlo con questa password.`
      );
    }

    try {
      let valid = false;

      if (found.salt && found.passwordHash) {
        valid = (await hashPassword(loginPassword, found.salt)) === found.passwordHash;
      } else if (typeof found.password === 'string') {
        valid = found.password === loginPassword;

        if (valid) {
          const salt = makeSalt();
          const passwordHash = await hashPassword(loginPassword, salt);
          const { password, ...account } = found;

          const migrated = users.map((u) =>
            u.id === found.id ? { ...account, salt, passwordHash } : u
          );
          await saveUsers(migrated);
        }
      }

      if (!valid) {
        return Alert.alert('Accesso negato', 'Controlla nome utente e password.');
      }

      setSession({
        id: found.id,
        name: found.name,
        username: found.username,
        role: found.role,
      });
      setLoginPassword('');
    } catch {
      Alert.alert('Errore', 'Non è stato possibile verificare le credenziali.');
    }
  };

  const getDbHelpers = () => {
    const m = FirebaseDbMod.default || FirebaseDbMod;
    const db = typeof m === 'function' ? m() : (typeof FirebaseDbMod.getDatabase === 'function' ? FirebaseDbMod.getDatabase() : m);
    if (!db) throw new Error('Database cloud non disponibile.');
    if (typeof db.ref === 'function') {
      return {
        onceVal: async (path) => (await db.ref(path).once('value')).val(),
        setVal: async (path, val) => db.ref(path).set(val),
      };
    }
    return {
      onceVal: async (path) => (await FirebaseDbMod.get(FirebaseDbMod.ref(db, path))).val(),
      setVal: async (path, val) => FirebaseDbMod.set(FirebaseDbMod.ref(db, path), val),
    };
  };

  const verifyCloudAccess = async () => {
    const { onceVal, setVal } = getDbHelpers();
    const current = getCurrentCloudUser();
    setHasCloudUser(!!current);
    setIsCloudEmailVerified(!!current?.emailVerified);
    if (!current) return;

    const email = String(current.email || '').trim().toLowerCase();
    if (email === OWNER_EMAIL) {
      if (!current.emailVerified) {
        setCloudStatus('Verifica prima la tua email proprietaria dal link inviato da Firebase, poi premi Ricontrolla.');
        return;
      }
      const allDevices = (await onceVal('ownerDevices')) || {};
      const approvedEntries = Object.entries(allDevices).filter(([, item]) => item && item.approved === true);
      let isApproved = approvedEntries.some(([key]) => key === deviceId);

      if (!isApproved && approvedEntries.length === 0 && deviceId) {
        await setVal(`ownerDevices/${deviceId}`, {
          deviceId,
          label: 'Tablet Principale',
          platform: 'android',
          approved: true,
          ownerUid: current.uid,
          updatedAt: new Date().toISOString(),
        });
        isApproved = true;
      }

      if (isApproved) {
        setSession({
          id: current.uid,
          name: 'Amministratore Unico',
          username: email,
          role: 'Amministratore unico',
          cloudUid: current.uid,
          deviceId,
        });
        setCloudPassword('');
      } else {
        setCloudStatus(
          'Account proprietario verificato, ma questo secondo dispositivo non è ancora stato autorizzato dal dispositivo principale.'
        );
      }
      return;
    }

    const roleSnap = await dbMod.ref(`roles/${current.uid}`).once('value');
    const roleData = roleSnap.val();
    if (roleData && roleData.active === true && ALLOWED_ROLES.includes(roleData.role)) {
      setSession({
        id: current.uid,
        name: current.displayName || email,
        username: email,
        role: roleData.role,
        cloudUid: current.uid,
        deviceId,
      });
      setCloudPassword('');
      return;
    }

    setCloudStatus('Account autenticato: nessuna autorizzazione attiva ancora assegnata dal proprietario.');
  };

  const handleCloudAuth = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (cloudTab === 'register') {
        await registerCloudIdentity(cloudEmail, cloudPassword);
        if (cloudEmail.trim().toLowerCase() !== OWNER_EMAIL) {
          await submitAccessRequest({
            name: reqName,
            requestedRole: reqRole,
            note: reqNote,
          });
          setCloudStatus('Registrazione completata e richiesta inviata. Attendi approvazione dall’Amministratore unico.');
        } else {
          setCloudStatus('Email di verifica inviata al proprietario. Confermala e poi premi Verifica stato.');
        }
      } else {
        await signInCloudIdentity(cloudEmail, cloudPassword);
        await verifyCloudAccess();
      }
    } catch (e) {
      Alert.alert('Attenzione', e.message || 'Operazione cloud non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshCloud = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshCloudIdentity();
      await verifyCloudAccess();
    } catch (e) {
      Alert.alert('Attenzione', e.message || 'Impossibile aggiornare lo stato.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setSession(null);
    const ownerExists = users.some(
      (u) => u.role === 'Amministratore unico' || u.isOwner
    );
    setMode(ownerExists ? 'login' : 'blocked');
    setLoginPassword('');
    setCloudPassword('');
    try {
      if (getCurrentCloudUser()) await signOutCloudIdentity();
    setHasCloudUser(false);
    setIsCloudEmailVerified(false);
    } catch {}
  };

  if (loading) {
    return <View style={s.page}><Text style={s.heading}>SABRYFOX2025</Text></View>;
  }

  const content = typeof children === 'function'
    ? children(session)
    : children;

  if (storageError) {
    return (
      <View style={s.page}>
        <Image source={require('../../assets/logo.jpg')} style={s.logo} resizeMode="contain" />
        <Text style={s.heading}>ARCHIVIO PROTETTO</Text>
        <Text style={s.description}>Non è stato possibile leggere le credenziali. Non cancellare i dati dell'applicazione.</Text>
        <Button title="RIPROVA" onPress={() => setStorageError(false)} />
      </View>
    );
  }

  if (session) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: '#21121B' }}>
        <View style={s.sessionBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.sessionName}>{session.name}</Text>
            <Text style={s.sessionRole}>{session.role.toUpperCase()}</Text>
          </View>
          <Pressable onPress={logout}>
            <Text style={s.sessionAction}>ESCI</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{content}</View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/logo.jpg')}
          style={s.logo}
          resizeMode="contain"
        />

        <Text style={s.brand}>SABRYFOX2025</Text>
        <Text style={s.subtitle}>LINGERIE</Text>
        <View style={s.line} />

        {mode === 'blocked' ? (
          <>
            <Text style={s.heading}>DISPOSITIVO NON AUTORIZZATO</Text>
            <Text style={s.description}>
              Questo dispositivo non può creare un Amministratore unico. Accedi con un account già autorizzato oppure invia una richiesta di accesso per un ruolo aziendale o VIP.
            </Text>
            {deviceId ? (
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <Text style={s.deviceBadge}>ID Dispositivo: {deviceId}</Text>
                <Pressable
                  onPress={() => {
                    Clipboard.setString(deviceId);
                    Alert.alert('Copiato', 'Il codice del dispositivo è stato copiato.');
                  }}
                  style={{ borderWidth: 1, borderColor: '#C9A66B', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#E7D4AC', fontSize: 12, fontWeight: '800' }}>COPIA CODICE DISPOSITIVO</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={s.tabsRow}>
              <Pressable
                style={[s.tabBtn, cloudTab === 'signin' && s.tabBtnActive]}
                onPress={() => setCloudTab('signin')}
              >
                <Text style={[s.tabText, cloudTab === 'signin' && s.tabTextActive]}>HO GIÀ UN ACCOUNT</Text>
              </Pressable>
              <Pressable
                style={[s.tabBtn, cloudTab === 'register' && s.tabBtnActive]}
                onPress={() => setCloudTab('register')}
              >
                <Text style={[s.tabText, cloudTab === 'register' && s.tabTextActive]}>RICHIEDI ACCESSO</Text>
              </Pressable>
            </View>

            <Field label="EMAIL" value={cloudEmail} onChangeText={setCloudEmail} placeholder="nome@email.it" />
            <Field label="PASSWORD" value={cloudPassword} onChangeText={setCloudPassword} placeholder="Almeno 8 caratteri" secureTextEntry />

            {cloudTab === 'register' ? (
              <>
                <Field label="NOME E COGNOME" value={reqName} onChangeText={setReqName} placeholder="Il tuo nome" />
                <Text style={s.label}>RUOLO RICHIESTO (APPROVAZIONE OBBLIGATORIA)</Text>
                <View style={s.roles}>
                  {ALLOWED_ROLES.map((r) => (
                    <Pressable
                      key={r}
                      style={[s.roleButton, reqRole === r && s.roleActive]}
                      onPress={() => setReqRole(r)}
                    >
                      <Text style={[s.roleButtonText, reqRole === r && s.roleActiveText]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ height: 10 }} />
                <Field label="NOTA (OPZIONALE)" value={reqNote} onChangeText={setReqNote} placeholder="Reparto o riferimento" />
              </>
            ) : null}

            <Button
              title={busy ? 'ATTENDI...' : cloudTab === 'register' ? 'INVIA RICHIESTA DI ACCESSO' : 'VERIFICA E ACCEDI'}
              onPress={handleCloudAuth}
            />

            {hasCloudUser ? (
              <>
                <Button title="RICONTROLLA STATO APPROVAZIONE" onPress={handleRefreshCloud} secondary />
                {!isCloudEmailVerified ? (
                  <Button
                    title="REINVIA EMAIL DI VERIFICA"
                    onPress={() => resendCloudVerification().then(() => Alert.alert('Inviata', 'Controlla la tua casella email.')).catch((e) => Alert.alert('Errore', e.message))}
                    secondary
                  />
                ) : null}
              </>
            ) : null}

            {cloudStatus ? (
              <View style={s.statusBox}>
                <Text style={s.statusText}>{cloudStatus}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={s.heading}>ACCESSO PERSONALE</Text>
            <Text style={s.description}>Inserisci le tue credenziali.</Text>

            <Field label="NOME UTENTE" value={loginUsername} onChangeText={setLoginUsername} placeholder="Username" />
            <Field label="PASSWORD" value={loginPassword} onChangeText={setLoginPassword} placeholder="La tua password" secureTextEntry />

            <Button title="ENTRA CON NOME UTENTE" onPress={login} />
            <Button title="SALVA / AGGIORNA ACCESSO LOCALE" onPress={createOrResetLocalOwner} secondary />
            <Button title="PASSA A ACCESSO CLOUD (AMMINISTRATORE)" onPress={() => setMode('blocked')} secondary />
          </>
        )}

        <Text style={s.footer}>IL MONDO SABRYFOX2025 LINGERIE</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#21121B', justifyContent: 'center' },
  container: { padding: 20, paddingTop: 18, paddingBottom: 22 },
  logo: { width: 112, height: 112, alignSelf: 'center', marginBottom: 12 },
  brand: { color: '#E7D4AC', fontSize: 23, textAlign: 'center', letterSpacing: 3, fontFamily: 'Georgia' },
  subtitle: { color: '#C9A66B', fontSize: 11, textAlign: 'center', letterSpacing: 5, marginTop: 6 },
  line: { height: 1, backgroundColor: '#C9A66B', width: 65, alignSelf: 'center', marginVertical: 15 },
  heading: { color: '#E7D4AC', fontSize: 18, textAlign: 'center', letterSpacing: 1.2, marginBottom: 9, fontFamily: 'Georgia' },
  description: { color: '#D5C1C6', textAlign: 'center', fontSize: 12, lineHeight: 19, marginBottom: 14 },
  deviceBadge: { color: '#C9A66B', fontSize: 14, textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabBtn: { flex: 1, borderWidth: 1, borderColor: '#C9A66B', borderRadius: 18, paddingVertical: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#C9A66B' },
  tabText: { color: '#E7D4AC', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#21121B' },
  field: { marginBottom: 10 },
  label: { color: '#C9A66B', fontSize: 9, letterSpacing: 1.5, marginBottom: 7, fontWeight: '800' },
  input: { backgroundColor: '#FFFDFC', borderRadius: 11, padding: 12, color: '#21121B', fontSize: 13 },
  button: { backgroundColor: '#C9A66B', borderRadius: 25, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#21121B', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#C9A66B' },
  secondaryText: { color: '#E7D4AC' },
  statusBox: { backgroundColor: '#3D1B2D', borderRadius: 11, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#C9A66B' },
  statusText: { color: '#FFFDFC', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: { color: '#AD949B', fontSize: 8, letterSpacing: 1.5, textAlign: 'center', marginTop: 32 },
  sessionBar: { backgroundColor: '#21121B', paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 15 },
  sessionName: { color: '#FFFDFC', fontSize: 11, fontWeight: '700' },
  sessionRole: { color: '#C9A66B', fontSize: 8, marginTop: 3, letterSpacing: 1 },
  sessionAction: { color: '#E7D4AC', fontSize: 9, fontWeight: '800', padding: 5 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  roleButton: { borderColor: '#C9A66B', borderWidth: 1, borderRadius: 18, padding: 9 },
  roleActive: { backgroundColor: '#C9A66B' },
  roleButtonText: { color: '#E7D4AC', fontSize: 9 },
  roleActiveText: { color: '#21121B', fontWeight: '800' },
});
