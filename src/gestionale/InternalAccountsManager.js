import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  ALLOWED_ROLES,
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
} from './CloudRoleService';
import {
  listOwnerDevices,
  approveOwnerDevice,
  revokeOwnerDevice,
  removeOwnerDevice,
} from './DeviceAuthorizationService';

const KEY = 'sabryfox_accounts_v1';
const ROLES = ['Amministrazione e Finanze', 'Dipendenti'];

const colors = {
  dark: '#21121B',
  gold: '#C9A66B',
  light: '#FFFDFC',
  cream: '#F7F0E9',
  muted: '#8D777F',
  red: '#A33B45',
};

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

export default function InternalAccountsManager({ session }) {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES[1]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [requests, setRequests] = useState([]);
  const [devices, setDevices] = useState([]);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');

  const owner = session?.role === 'Amministratore unico';

  const loadAccounts = async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const saved = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(saved)) throw new Error('Archivio account non valido.');
      setAccounts(saved);
      setError('');
    } catch (e) {
      setError(e.message || 'Impossibile leggere gli account.');
    } finally {
      setLoading(false);
    }
  };

  const loadCloudApprovals = async () => {
    if (!owner) return;
    setCloudLoading(true);
    try {
      const [reqs, devs] = await Promise.all([
        listAccessRequests(),
        listOwnerDevices(),
      ]);
      setRequests(reqs);
      setDevices(devs);
      setCloudMsg('');
    } catch (e) {
      setCloudMsg(e.message || 'Accedi con account cloud proprietario verificato per gestire richieste e dispositivi.');
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    if (owner) {
      loadAccounts();
      loadCloudApprovals();
    }
  }, [owner]);

  const handleApproveDevice = async (targetId, targetLabel) => {
    try {
      await approveOwnerDevice(targetId, targetLabel);
      setNewDeviceId('');
      setNewDeviceLabel('');
      await loadCloudApprovals();
      Alert.alert('Dispositivo autorizzato', 'Il dispositivo è stato aggiunto (max 2 autorizzati).');
    } catch (e) {
      Alert.alert('Autorizzazione negata', e.message || 'Impossibile autorizzare il dispositivo.');
    }
  };

  const handleRevokeDevice = async (targetId) => {
    try {
      await revokeOwnerDevice(targetId);
      await loadCloudApprovals();
      Alert.alert('Dispositivo revocato', 'L’accesso del dispositivo è stato disattivato.');
    } catch (e) {
      Alert.alert('Errore', e.message || 'Impossibile revocare il dispositivo.');
    }
  };
  const handleDeleteDevice = (devItem) => {
    const targetId = devItem?.deviceId || devItem?.key;
    if (!targetId) return;
    Alert.alert(
      'Eliminare dispositivo?',
      `${devItem?.label || 'Dispositivo'} (${targetId})\nVerrà rimosso definitivamente dall’elenco cloud.`,
      [
        { text: 'ANNULLA', style: 'cancel' },
        { text: 'ELIMINA', style: 'destructive', onPress: async () => {
          try { await removeOwnerDevice(targetId); await loadCloudApprovals(); Alert.alert('Dispositivo eliminato', 'Il dispositivo è stato rimosso.'); }
          catch (e) { Alert.alert('Errore', e.message || 'Impossibile eliminare il dispositivo.'); }
        }},
      ]
    );
  };

  const handleDeleteAccount = (account) => {
    if (!owner || !account?.id) return;
    if (account.id === session?.id || account.role === 'Amministratore unico' || account.isOwner) {
      return Alert.alert('Operazione non consentita', 'Non puoi eliminare l’account proprietario attivo.');
    }
    Alert.alert(
      'Eliminare account interno?',
      `${account.name} (@${account.username} · ${account.role})\nL’account verrà rimosso da questo dispositivo.`,
      [
        { text: 'ANNULLA', style: 'cancel' },
        { text: 'ELIMINA', style: 'destructive', onPress: async () => {
          try { const raw = await SecureStore.getItemAsync(KEY); const current = raw ? JSON.parse(raw) : []; if (!Array.isArray(current)) throw new Error('Archivio account non valido.'); const next = current.filter((u) => u.id !== account.id); await SecureStore.setItemAsync(KEY, JSON.stringify(next)); setAccounts(next); Alert.alert('Account eliminato', 'L’account interno è stato rimosso.'); }
          catch (e) { Alert.alert('Errore', e.message || 'Impossibile eliminare l’account.'); }
        }},
      ]
    );
  };

  const handleApproveRequest = async (reqItem) => {
    const chosenRole = ALLOWED_ROLES.includes(reqItem.requestedRole)
      ? reqItem.requestedRole
      : 'Dipendenti';
    try {
      await approveAccessRequest(reqItem.uid, chosenRole);
      await loadCloudApprovals();
      Alert.alert('Richiesta approvata', `Ruolo "${chosenRole}" assegnato.`);
    } catch (e) {
      Alert.alert('Errore approvazione', e.message || 'Impossibile approvare la richiesta.');
    }
  };

  const handleRejectRequest = async (uid) => {
    try {
      await rejectAccessRequest(uid);
      await loadCloudApprovals();
      Alert.alert('Richiesta rifiutata', 'La richiesta è stata rimossa.');
    } catch (e) {
      Alert.alert('Errore', e.message || 'Impossibile rifiutare la richiesta.');
    }
  };

  const createAccount = async () => {
    if (!owner || saving) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !cleanUsername || !password) {
      return Alert.alert('Dati mancanti', 'Inserisci nome, email, username e password.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Alert.alert('Email non valida', 'Inserisci un indirizzo email valido.');
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      return Alert.alert('Username non valido', 'Usa 3–30 caratteri: lettere, numeri, punto, trattino o underscore.');
    }
    if (password.length < 8) {
      return Alert.alert('Password troppo corta', 'La password deve contenere almeno 8 caratteri.');
    }
    if (!ROLES.includes(role)) {
      return Alert.alert('Ruolo non valido', 'Puoi creare soltanto account interni autorizzati.');
    }

    setSaving(true);
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const current = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(current)) throw new Error('Archivio account non valido.');

      const owners = current.filter(
        (u) => u.role === 'Amministratore unico' || u.role === 'Amministratore' || u.isOwner
      );
      if (owners.length !== 1 || owners[0].id !== session.id) {
        throw new Error('Solo il proprietario registrato può autorizzare account.');
      }

      if (current.some((u) => String(u.username || '').toLowerCase() === cleanUsername)) {
        throw new Error('Questo username è già utilizzato.');
      }
      if (current.some((u) => String(u.email || '').toLowerCase() === cleanEmail)) {
        throw new Error('Questa email è già associata a un account.');
      }

      const salt = makeSalt();
      const passwordHash = await hashPassword(password, salt);
      const id = Array.from(Crypto.getRandomBytes(16))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');

      const next = [...current, {
        id,
        name: cleanName,
        email: cleanEmail,
        username: cleanUsername,
        role,
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
        active: true,
      }];

      await SecureStore.setItemAsync(KEY, JSON.stringify(next));
      setAccounts(next);
      setName('');
      setEmail('');
      setUsername('');
      setPassword('');
      Alert.alert('Account creato', 'L’account interno è stato registrato su questo dispositivo.');
    } catch (e) {
      Alert.alert('Creazione non riuscita', e.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  if (!owner) return null;

  const fieldStyle = {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#DCCDBD',
    borderRadius: 9,
    padding: 11,
    color: colors.dark,
    fontSize: 15,
    marginTop: 7,
  };

  return (
    <View style={{
      backgroundColor: colors.light,
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    }}>
      <Text style={{ color: colors.dark, fontSize: 19, fontWeight: 'bold' }}>
        Dispositivi e richieste di accesso
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        Autorizza il secondo dispositivo (massimo 2) e approva o rifiuta le richieste per Amministrazione e Finanze, Dipendenti o Clienti VIP.
      </Text>

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 14 }}>ID DISPOSITIVO DA AUTORIZZARE</Text>
      <TextInput
        value={newDeviceId}
        onChangeText={setNewDeviceId}
        placeholder="es. dev_android_..."
        placeholderTextColor={colors.muted}
        style={fieldStyle}
      />

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 10 }}>ETICHETTA DISPOSITIVO</Text>
      <TextInput
        value={newDeviceLabel}
        onChangeText={setNewDeviceLabel}
        placeholder="es. Cellulare personale"
        placeholderTextColor={colors.muted}
        style={fieldStyle}
      />

      <Pressable
        onPress={() => handleApproveDevice(newDeviceId, newDeviceLabel || 'Secondo dispositivo')}
        style={{
          backgroundColor: colors.dark,
          borderRadius: 22,
          padding: 12,
          alignItems: 'center',
          marginTop: 12,
        }}
      >
        <Text style={{ color: colors.gold, fontWeight: 'bold' }}>AUTORIZZA DISPOSITIVO</Text>
      </Pressable>

      <Pressable
        onPress={loadCloudApprovals}
        style={{
          borderWidth: 1,
          borderColor: colors.dark,
          borderRadius: 22,
          padding: 10,
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Text style={{ color: colors.dark, fontWeight: 'bold', fontSize: 13 }}>
          {cloudLoading ? 'AGGIORNAMENTO...' : 'AGGIORNA DISPOSITIVI E RICHIESTE'}
        </Text>
      </Pressable>

      {cloudMsg ? (
        <Text style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>{cloudMsg}</Text>
      ) : null}

      <Text style={{ color: colors.dark, fontSize: 15, fontWeight: 'bold', marginTop: 16 }}>
        Dispositivi registrati ({devices.length})
      </Text>
      {devices.map((d) => (
        <View key={d.key} style={{ borderTopWidth: 1, borderTopColor: '#E8DDD2', paddingVertical: 8, marginTop: 4 }}>
          <Text style={{ color: colors.dark, fontWeight: 'bold' }}>{d.label} — {d.approved ? 'ATTIVO' : 'REVOCATO'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{d.deviceId}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {!d.approved ? (
              <Pressable onPress={() => handleApproveDevice(d.deviceId, d.label)} style={{ backgroundColor: colors.dark, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>APPROVA</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => handleRevokeDevice(d.deviceId)} style={{ backgroundColor: colors.red, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: colors.light, fontSize: 12, fontWeight: 'bold' }}>REVOCA</Text>
              </Pressable>
            <Pressable onPress={() => handleDeleteDevice(d)} style={{ backgroundColor: '#6E1F28', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: colors.light, fontSize: 12, fontWeight: 'bold' }}>ELIMINA</Text>
            </Pressable>
            )}
          </View>
        </View>
      ))}

      <Text style={{ color: colors.dark, fontSize: 15, fontWeight: 'bold', marginTop: 16 }}>
        Richieste in attesa ({requests.length})
      </Text>
      {requests.map((r) => (
        <View key={r.uid} style={{ borderTopWidth: 1, borderTopColor: '#E8DDD2', paddingVertical: 8, marginTop: 4 }}>
          <Text style={{ color: colors.dark, fontWeight: 'bold' }}>{r.name} ({r.email})</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Ruolo richiesto: {r.requestedRole}</Text>
          {r.note ? <Text style={{ color: colors.muted, fontSize: 12 }}>Nota: {r.note}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Pressable onPress={() => handleApproveRequest(r)} style={{ backgroundColor: colors.dark, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>APPROVA</Text>
            </Pressable>
            <Pressable onPress={() => handleRejectRequest(r.uid)} style={{ backgroundColor: colors.red, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: colors.light, fontSize: 12, fontWeight: 'bold' }}>RIFIUTA</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={{ color: colors.dark, fontSize: 19, fontWeight: 'bold', marginTop: 22 }}>
        Gestione account interni locali
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        Crea account per Amministrazione e Finanze oppure Dipendenti. L’Amministratore unico non è un ruolo assegnabile.
      </Text>

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 15 }}>NOME E COGNOME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Nome della persona"
        placeholderTextColor={colors.muted} style={fieldStyle} />

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 12 }}>EMAIL PERSONALE</Text>
      <TextInput value={email} onChangeText={setEmail} keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false}
        placeholder="nome@esempio.it" placeholderTextColor={colors.muted} style={fieldStyle} />

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 12 }}>USERNAME</Text>
      <TextInput value={username} onChangeText={setUsername} autoCapitalize="none"
        placeholder="Nome utente" placeholderTextColor={colors.muted} style={fieldStyle} />

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 12 }}>PASSWORD INIZIALE</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry
        placeholder="Almeno 8 caratteri" placeholderTextColor={colors.muted} style={fieldStyle} />

      <Text style={{ color: colors.dark, fontWeight: 'bold', marginTop: 15 }}>RUOLO DA ASSEGNARE</Text>
      {ROLES.map((item) => (
        <Pressable key={item} onPress={() => setRole(item)}
          style={{
            borderWidth: 1,
            borderColor: role === item ? colors.gold : '#DCCDBD',
            backgroundColor: role === item ? '#F4E9D6' : colors.light,
            borderRadius: 9,
            padding: 12,
            marginTop: 7,
          }}>
          <Text style={{ color: colors.dark, fontWeight: 'bold' }}>
            {role === item ? '✓  ' : ''}{item}
          </Text>
        </Pressable>
      ))}

      <Pressable disabled={saving} onPress={createAccount}
        style={{
          backgroundColor: colors.dark,
          borderRadius: 22,
          padding: 14,
          alignItems: 'center',
          marginTop: 15,
          opacity: saving ? 0.6 : 1,
        }}>
        <Text style={{ color: colors.gold, fontWeight: 'bold' }}>
          {saving ? 'SALVATAGGIO...' : 'CREA ACCOUNT INTERNO'}
        </Text>
      </Pressable>

      <Text style={{ color: colors.dark, fontSize: 16, fontWeight: 'bold', marginTop: 22 }}>
        Account registrati: {accounts.length}
      </Text>
      {loading ? (
        <Text style={{ color: colors.muted, marginTop: 8 }}>Caricamento...</Text>
      ) : error ? (
        <Text style={{ color: colors.red, marginTop: 8 }}>{error}</Text>
      ) : accounts.map((account) => (
        <View key={account.id} style={{
          borderTopWidth: 1,
          borderTopColor: '#E8DDD2',
          paddingVertical: 10,
          marginTop: 5,
        }}>
          <Text style={{ color: colors.dark, fontWeight: 'bold' }}>{account.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            @{account.username} · {account.role}
          </Text>
            {account.id !== session?.id && account.role !== 'Amministratore unico' && !account.isOwner ? (
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <Pressable onPress={() => handleDeleteAccount(account)} style={{ backgroundColor: colors.red, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: colors.light, fontSize: 12, fontWeight: 'bold' }}>ELIMINA</Text>
                </Pressable>
              </View>
            ) : null}
        </View>
      ))}
    </View>
  );
}
