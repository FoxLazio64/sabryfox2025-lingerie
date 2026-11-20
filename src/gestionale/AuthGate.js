import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { ADMIN_ACTIVATION_HASH } from './activation-config';

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

const KEY = 'sabryfox_accounts_v1';
const INITIAL_CLEANUP_KEY = 'sabryfox_initial_clean_v1';
const ASYNC_STORAGE_PREFIX = '@sabryfox/';

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
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
            accessibilityLabel={visible ? "Nascondi password" : "Mostra password"}
            style={{
              position: 'absolute',
              right: 10,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              paddingHorizontal: 6
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
  const [mode, setMode] = useState('login');
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(null);
  const [storageError, setStorageError] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [activationCode, setActivationCode] = useState('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');


  useEffect(() => {
    let active = true;

    (async () => {
      try {
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

        // L'app interna conserva esclusivamente l'unico Amministratore.
        let finalUsers = owners.length === 1 ? [owners[0]] : [];

        // Pulizia iniziale eseguita una sola volta, solo se esiste un unico proprietario.
        if (owners.length === 1) {
          const cleanupDone = await SecureStore.getItemAsync(INITIAL_CLEANUP_KEY);

          if (cleanupDone !== '1') {
            const ownerAccount = owners[0];
            const allKeys = await AsyncStorage.getAllKeys();
            const appKeys = allKeys.filter((key) =>
              key.startsWith(ASYNC_STORAGE_PREFIX)
            );

            if (appKeys.length > 0) {
              await AsyncStorage.multiRemove(appKeys);
            }

            finalUsers = [ownerAccount];

            await SecureStore.setItemAsync(KEY, JSON.stringify(finalUsers));
            await SecureStore.setItemAsync(INITIAL_CLEANUP_KEY, '1');
          }
        }

        if (active) {
          if (JSON.stringify(finalUsers) !== JSON.stringify(saved)) {
            await SecureStore.setItemAsync(KEY, JSON.stringify(finalUsers));
          }
          setUsers(finalUsers);
          setMode(owners.length === 1 ? 'login' : 'setup');
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

  const createAdmin = async () => {
    if (users.some((u) => u.role === 'Amministratore unico' || u.isOwner)) {
      return Alert.alert('Amministratore già presente', 'Su questo dispositivo esiste già un amministratore.');
    }

    const suppliedCode = activationCode.replace(/\s+/g, '').toUpperCase();

    if (suppliedCode.length !== 64) {
      return Alert.alert('Codice necessario', 'Inserisci il codice riservato di attivazione.');
    }

    let suppliedHash;
    try {
      suppliedHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        suppliedCode
      );
    } catch {
      return Alert.alert('Errore', 'Impossibile verificare il codice di attivazione.');
    }

    if (
      !/^[a-f0-9]{64}$/i.test(ADMIN_ACTIVATION_HASH) ||
      !constantTimeEqual(suppliedHash.toLowerCase(), ADMIN_ACTIVATION_HASH.toLowerCase())
    ) {
      return Alert.alert('Codice non valido', 'Il codice di attivazione non è corretto.');
    }

    if (!name.trim() || username.trim().length < 3) {
      return Alert.alert('Dati mancanti', 'Inserisci nome e utente di almeno 3 caratteri.');
    }

    if (password.length < 8) {
      return Alert.alert('Password non valida', 'Scegli una password di almeno 8 caratteri.');
    }

    if (password !== confirm) {
      return Alert.alert('Attenzione', 'Le password non coincidono.');
    }

    const normalized = username.trim().toLowerCase();
    if (users.some((u) => u.username === normalized)) {
      return Alert.alert('Utente già esistente', 'Scegli un altro nome utente.');
    }

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    const admin = {
      id: String(Date.now()),
      name: name.trim(),
      username: normalized,
      salt,
      passwordHash,
      role: 'Amministratore unico',
      isOwner: true,
    };

    try {
      // Segna la pulizia iniziale come completata prima di accedere al gestionale.
      await SecureStore.setItemAsync(INITIAL_CLEANUP_KEY, '1');
      await saveUsers([...users, admin]);
      setActivationCode('');
      setSession({
        id: admin.id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
      });
    } catch {
      Alert.alert('Errore', 'Non è stato possibile salvare l’amministratore.');
    }
  };

  const login = async () => {
    const found = users.find(
      (u) => u.username === loginUsername.trim().toLowerCase()
    );

    if (!found) {
      return Alert.alert('Accesso negato', 'Controlla nome utente e password.');
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

  const logout = () => {
    setSession(null);
    const ownerExists = users.some(
      (u) => u.role === 'Amministratore unico' || u.isOwner
    );
    setMode(ownerExists ? 'login' : 'setup');
    setLoginPassword('');
    setActivationCode('');
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

        {mode === 'setup' ? (
          <>
            <Text style={s.heading}>PRIMA CONFIGURAZIONE</Text>
            <Text style={s.description}>Inserisci il codice riservato e crea l'unico account amministratore di questo dispositivo.</Text>
            <Field label="CODICE DI ATTIVAZIONE RISERVATO" value={activationCode} onChangeText={setActivationCode} placeholder="Codice riservato" secureTextEntry />

            <Field label="NOME E COGNOME" value={name} onChangeText={setName} placeholder="Il tuo nome" />
            <Field label="NOME UTENTE" value={username} onChangeText={setUsername} placeholder="Scegli un username" />
            <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Almeno 8 caratteri" secureTextEntry />
            <Field label="CONFERMA PASSWORD" value={confirm} onChangeText={setConfirm} placeholder="Ripeti la password" secureTextEntry />

            <Button title="CREA AMMINISTRATORE UNICO" onPress={createAdmin} />
          </>
        ) : (
          <>
            <Text style={s.heading}>ACCESSO PERSONALE</Text>
            <Text style={s.description}>Inserisci le tue credenziali.</Text>

            <Field label="NOME UTENTE" value={loginUsername} onChangeText={setLoginUsername} placeholder="Username" />
            <Field label="PASSWORD" value={loginPassword} onChangeText={setLoginPassword} placeholder="La tua password" secureTextEntry />

            <Button title="ACCEDI" onPress={login} />
          </>
        )}


        <Text style={s.footer}>IL MONDO SABRYFOX2025 LINGERIE</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#21121B', justifyContent: 'center' },
  manager: { flex: 1, backgroundColor: '#21121B' },
  container: { padding: 20, paddingTop: 18, paddingBottom: 22 },
  logo: { width: 112, height: 112, alignSelf: 'center', marginBottom: 12 },
  brand: { color: '#E7D4AC', fontSize: 23, textAlign: 'center', letterSpacing: 3, fontFamily: 'Georgia' },
  subtitle: { color: '#C9A66B', fontSize: 11, textAlign: 'center', letterSpacing: 5, marginTop: 6 },
  line: { height: 1, backgroundColor: '#C9A66B', width: 65, alignSelf: 'center', marginVertical: 15 },
  heading: { color: '#E7D4AC', fontSize: 18, textAlign: 'center', letterSpacing: 1.2, marginBottom: 9, fontFamily: 'Georgia' },
  description: { color: '#D5C1C6', textAlign: 'center', fontSize: 12, lineHeight: 19, marginBottom: 14 },
  field: { marginBottom: 10 },
  label: { color: '#C9A66B', fontSize: 9, letterSpacing: 1.5, marginBottom: 7, fontWeight: '800' },
  input: { backgroundColor: '#FFFDFC', borderRadius: 11, padding: 12, color: '#21121B', fontSize: 13 },
  button: { backgroundColor: '#C9A66B', borderRadius: 25, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#21121B', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#C9A66B' },
  secondaryText: { color: '#E7D4AC' },
  footer: { color: '#AD949B', fontSize: 8, letterSpacing: 1.5, textAlign: 'center', marginTop: 32 },
  sessionBar: { backgroundColor: '#21121B', paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 15 },
  sessionName: { color: '#FFFDFC', fontSize: 11, fontWeight: '700' },
  sessionRole: { color: '#C9A66B', fontSize: 8, marginTop: 3, letterSpacing: 1 },
  sessionAction: { color: '#E7D4AC', fontSize: 9, fontWeight: '800', padding: 5 },
  userCard: { backgroundColor: '#3D1B2D', borderRadius: 12, padding: 13, marginBottom: 9 },
  userName: { color: '#FFFDFC', fontSize: 13, fontWeight: '700' },
  userInfo: { color: '#D5C1C6', fontSize: 10, marginTop: 4 },
  role: { color: '#C9A66B', fontSize: 10, marginTop: 6 },
  section: { color: '#E7D4AC', fontSize: 12, letterSpacing: 1.2, marginTop: 24, marginBottom: 12 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  roleButton: { borderColor: '#C9A66B', borderWidth: 1, borderRadius: 18, padding: 9 },
  roleActive: { backgroundColor: '#C9A66B' },
  roleButtonText: { color: '#E7D4AC', fontSize: 9 },
  roleActiveText: { color: '#21121B', fontWeight: '800' },
});
