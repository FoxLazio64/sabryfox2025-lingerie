import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import * as SecureStore from 'expo-secure-store';

const OWNER_EMAIL = 'fabio28164@gmail.com';
const UID_KEY = 'sabryfox_firebase_owner_uid_v1';

export default function CloudOwnerLink() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(auth().currentUser);
  const [linked, setLinked] = useState(false);
  const [status, setStatus] = useState('Account cloud non ancora collegato.');

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async current => {
      setUser(current);
      if (current?.email?.toLowerCase() === OWNER_EMAIL) {
        const saved = await SecureStore.getItemAsync(UID_KEY);
        setLinked(saved === current.uid);
        setStatus(current.emailVerified
          ? 'Email verificata. Pronto per collegare il dispositivo.'
          : 'Controlla la posta e verifica il tuo indirizzo email.');
      }
    });
    return unsubscribe;
  }, []);

  const finishLink = async candidate => {
    await candidate.reload();
    const current = auth().currentUser;

    if (!current || current.email?.toLowerCase() !== OWNER_EMAIL) {
      throw new Error('L’account autenticato non è quello del proprietario.');
    }
    if (!current.emailVerified) {
      throw new Error('Devi prima verificare il tuo indirizzo email.');
    }

    await current.getIdToken(true);

    const ref = database().ref('system/ownerUid');
    const snapshot = await ref.once('value');
    const existing = snapshot.val();

    if (existing && existing !== current.uid) {
      throw new Error('Esiste già un proprietario diverso. Collegamento bloccato per sicurezza.');
    }

    await ref.set(current.uid);
    await SecureStore.setItemAsync(UID_KEY, current.uid);

    setLinked(true);
    setStatus('Account proprietario collegato e verificato.');
    setUser(current);
    setPassword('');
    setConfirm('');
  };

  const startLink = async () => {
    if (busy || linked) return;

    setBusy(true);
    try {
      let current = auth().currentUser;

      if (current && current.email?.toLowerCase() !== OWNER_EMAIL) {
        throw new Error('Esci prima dall’eventuale altro account Firebase.');
      }

      if (!current) {
        if (password.length < 8 || password !== confirm) {
          throw new Error('Inserisci una password di almeno 8 caratteri e confermala.');
        }

        try {
          const credential = await auth().createUserWithEmailAndPassword(OWNER_EMAIL, password);
          current = credential.user;
        } catch (error) {
          if (error.code !== 'auth/email-already-in-use') throw error;
          const credential = await auth().signInWithEmailAndPassword(OWNER_EMAIL, password);
          current = credential.user;
        }
      }

      if (current.emailVerified) {
        await finishLink(current);
        Alert.alert('Collegamento completato', 'Il tuo account cloud è stato collegato.');
      } else {
        await current.sendEmailVerification();
        setUser(current);
        setStatus('Email di verifica inviata a ' + OWNER_EMAIL);
        Alert.alert(
          'Verifica email',
          'Apri la posta, premi il collegamento di verifica e poi torna qui per completare il collegamento.'
        );
      }
    } catch (error) {
      Alert.alert('Collegamento non riuscito', error?.message || 'Errore Firebase.');
    } finally {
      setBusy(false);
    }
  };

  const verifyAndFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const current = auth().currentUser;
      if (!current) throw new Error('Prima accedi al tuo account Firebase.');
      await finishLink(current);
      Alert.alert('Completato', 'Il dispositivo è collegato al proprietario unico.');
    } catch (error) {
      Alert.alert('Verifica non completata', error?.message || 'Controlla la verifica email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>COLLEGAMENTO CLOUD PROPRIETARIO</Text>
      <Text style={s.copy}>Account riservato all’unico Amministratore: {OWNER_EMAIL}</Text>
      <Text style={s.status}>{status}</Text>

      {!linked && !user && (
        <>
          <Text style={s.label}>NUOVA PASSWORD FIREBASE</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Almeno 8 caratteri"
            secureTextEntry
            autoCapitalize="none"
            style={s.input}
            editable={!busy}
          />
          <Text style={s.label}>CONFERMA PASSWORD FIREBASE</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Ripeti la password"
            secureTextEntry
            autoCapitalize="none"
            style={s.input}
            editable={!busy}
          />
        </>
      )}

      {!linked && (
        <Pressable disabled={busy} onPress={startLink} style={s.button}>
          <Text style={s.buttonText}>
            {busy ? 'OPERAZIONE IN CORSO...' : 'CREA / ACCEDI AL CLOUD'}
          </Text>
        </Pressable>
      )}

      {!linked && user?.email?.toLowerCase() === OWNER_EMAIL && (
        <Pressable disabled={busy} onPress={verifyAndFinish} style={s.button}>
          <Text style={s.buttonText}>
            {busy ? 'VERIFICA IN CORSO...' : 'HO VERIFICATO L’EMAIL'}
          </Text>
        </Pressable>
      )}

      {linked && <Text style={s.success}>PROPRIETARIO VERIFICATO</Text>}
      <Text style={s.note}>La password cloud non viene salvata nel gestionale e non deve essere comunicata a nessuno.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFDFC', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#EADFE0', marginVertical: 10 },
  title: { color: '#21121B', fontSize: 15, fontWeight: '900', letterSpacing: 0.7 },
  copy: { color: '#8B777E', fontSize: 12, lineHeight: 19, marginTop: 9 },
  status: { color: '#805D36', fontSize: 12, lineHeight: 19, marginVertical: 10 },
  label: { color: '#895F38', fontSize: 10, fontWeight: '800', marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#FBF6F2', borderWidth: 1, borderColor: '#EADFE0', borderRadius: 9, padding: 11, color: '#21121B' },
  button: { backgroundColor: '#3D1B2D', borderRadius: 22, padding: 13, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#E7D4AC', fontSize: 11, fontWeight: '900' },
  success: { color: '#47765D', fontWeight: '900', marginTop: 12 },
  note: { color: '#8B777E', fontSize: 10, lineHeight: 16, marginTop: 12 }
});
