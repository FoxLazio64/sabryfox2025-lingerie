import React, { useState } from 'react';
import {
  Alert, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  bytesToHex, hexToBytes, utf8ToBytes,
} from '@noble/hashes/utils.js';

const FORMAT = 'SABRYFOX2025_BACKUP';
const DATA_FORMAT = 'SABRYFOX2025_DATA';
const VERSION = 1;
const KDF_ITERATIONS = 600000;
const ACCOUNTS_KEY = 'sabryfox_accounts_v1';
const PREFIX = '@sabryfox/';
const EXCLUDED_KEYS = [
  '@sabryfox/token-v1',
  '@sabryfox/user-v1',
];

function decodeUtf8(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  const encoded = Array.from(
    bytes,
    (value) => '%' + value.toString(16).padStart(2, '0')
  ).join('');

  return decodeURIComponent(encoded);
}

function isOwnerAccount(account) {
  return account?.role === 'Amministratore unico' || account?.isOwner === true;
}

function validatePayload(payload) {
  if (
    !payload ||
    payload.format !== DATA_FORMAT ||
    payload.version !== VERSION ||
    !Array.isArray(payload.storage) ||
    !Array.isArray(payload.accounts)
  ) {
    throw new Error('Struttura del backup non valida.');
  }

  if (
    payload.storage.length > 200 ||
    payload.accounts.length < 1 ||
    payload.accounts.length > 500
  ) {
    throw new Error('Contenuto del backup non valido.');
  }

  const seen = new Set();

  for (const pair of payload.storage) {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== 'string' ||
      typeof pair[1] !== 'string' ||
      !pair[0].startsWith(PREFIX) ||
      EXCLUDED_KEYS.includes(pair[0]) ||
      seen.has(pair[0])
    ) {
      throw new Error('Archivio locale non valido.');
    }

    seen.add(pair[0]);
  }

  for (const account of payload.accounts) {
    if (
      !account ||
      typeof account !== 'object' ||
      typeof account.id !== 'string' ||
      typeof account.username !== 'string' ||
      typeof account.role !== 'string'
    ) {
      throw new Error('Archivio account non valido.');
    }
  }

  const owners = payload.accounts.filter(isOwnerAccount);

  if (owners.length !== 1) {
    throw new Error('Il backup deve contenere un solo Amministratore unico.');
  }
}

async function deriveKey(password, salt) {
  return pbkdf2Async(
    sha256,
    utf8ToBytes(password),
    salt,
    { c: KDF_ITERATIONS, dkLen: 32 }
  );
}

async function collectBackupData() {
  const allKeys = await AsyncStorage.getAllKeys();

  const keys = Array.from(new Set([
    ...allKeys.filter(
      (key) => key.startsWith(PREFIX) && !EXCLUDED_KEYS.includes(key)
    ),
    '@sabryfox/catalog-v1',
    '@sabryfox/cart-v1',
    '@sabryfox/favorites-v1',
    '@sabryfox/orders-v1',
    '@sabryfox/profile-v1',
    '@sabryfox/gestionale/products',
    '@sabryfox/gestionale/movements',
    '@sabryfox/gestionale/finance',
    '@sabryfox/demo/orders',
  ])).filter((key) => !EXCLUDED_KEYS.includes(key));

  const storage = (await AsyncStorage.multiGet(keys))
    .filter(([, value]) => value !== null);

  const rawAccounts = await SecureStore.getItemAsync(ACCOUNTS_KEY);
  const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];

  if (!Array.isArray(accounts) ||
      accounts.filter(isOwnerAccount).length !== 1) {
    throw new Error('Non è stato trovato un archivio account valido.');
  }

  return {
    format: DATA_FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    storage,
    accounts,
  };
}

async function createEncryptedFile(payload, password) {
  const salt = Crypto.getRandomBytes(16);
  const nonce = Crypto.getRandomBytes(12);
  const key = await deriveKey(password, salt);

  const clearBytes = utf8ToBytes(JSON.stringify(payload));
  const encrypted = gcm(key, nonce).encrypt(clearBytes);

  const envelope = {
    format: FORMAT,
    version: VERSION,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(encrypted),
  };

  const name = `SabryFox2025_Backup_${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.sfoxbackup`;

  const file = new File(Paths.cache, name);
  file.create();
  await file.write(JSON.stringify(envelope));

  return file;
}

async function readEncryptedBackup(uri, password) {
  const file = new File(uri);

  if (!file.exists || file.size <= 0 || file.size > 50 * 1024 * 1024) {
    throw new Error('File non valido o troppo grande.');
  }

  const envelope = JSON.parse(file.textSync());

  if (
    envelope?.format !== FORMAT ||
    envelope.version !== VERSION ||
    envelope.cipher !== 'AES-256-GCM' ||
    envelope.kdf !== 'PBKDF2-SHA256' ||
    envelope.iterations !== KDF_ITERATIONS ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.nonce !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('Formato del backup non riconosciuto.');
  }

  const salt = hexToBytes(envelope.salt);
  const nonce = hexToBytes(envelope.nonce);
  const encrypted = hexToBytes(envelope.ciphertext);

  if (salt.length !== 16 || nonce.length !== 12 || encrypted.length < 16) {
    throw new Error('Dati crittografici non validi.');
  }

  const key = await deriveKey(password, salt);
  const decrypted = gcm(key, nonce).decrypt(encrypted);
  const payload = JSON.parse(decodeUtf8(decrypted));

  validatePayload(payload);
  return payload;
}

async function restoreBackup(payload) {
  validatePayload(payload);

  const oldKeys = (await AsyncStorage.getAllKeys())
    .filter((key) => key.startsWith(PREFIX));

  const oldPairs = await AsyncStorage.multiGet(oldKeys);
  const oldAccounts = await SecureStore.getItemAsync(ACCOUNTS_KEY);
  const incomingKeys = new Set(payload.storage.map(([key]) => key));

  try {
    if (payload.storage.length) {
      await AsyncStorage.multiSet(payload.storage);
    }

    await SecureStore.setItemAsync(
      ACCOUNTS_KEY,
      JSON.stringify(payload.accounts)
    );

    const staleKeys = oldKeys.filter((key) => !incomingKeys.has(key));

    if (staleKeys.length) {
      await AsyncStorage.multiRemove(staleKeys);
    }
  } catch (error) {
    try {
      const currentKeys = (await AsyncStorage.getAllKeys())
        .filter((key) => key.startsWith(PREFIX));

      if (currentKeys.length) {
        await AsyncStorage.multiRemove(currentKeys);
      }

      if (oldPairs.length) {
        await AsyncStorage.multiSet(
          oldPairs.filter(([, value]) => value !== null)
        );
      }

      if (oldAccounts !== null) {
        await SecureStore.setItemAsync(ACCOUNTS_KEY, oldAccounts);
      } else {
        await SecureStore.deleteItemAsync(ACCOUNTS_KEY);
      }
    } catch {
      throw new Error(
        'Ripristino non riuscito e rollback incompleto. Non chiudere l’app.'
      );
    }

    throw error;
  }
}

function ActionButton({ title, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.button, disabled && s.disabled]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}

export default function BackupManager() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const createBackup = async () => {
    if (password.length < 12) {
      return Alert.alert(
        'Password troppo corta',
        'Utilizza almeno 12 caratteri.'
      );
    }

    if (password !== confirmation) {
      return Alert.alert(
        'Password diverse',
        'Le due password non coincidono.'
      );
    }

    setBusy(true);

    try {
      const payload = await collectBackupData();
      const file = await createEncryptedFile(payload, password);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Condivisione file non disponibile sul dispositivo.');
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Salva backup SabryFox2025',
      });

      setPassword('');
      setConfirmation('');

      Alert.alert(
        'Backup preparato',
        'Nel pannello di condivisione scegli una destinazione locale, come Download o una memoria USB, se disponibile.'
      );
    } catch (error) {
      Alert.alert('Backup non riuscito', error?.message || 'Errore inatteso.');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    if (password.length < 12) {
      return Alert.alert(
        'Password necessaria',
        'Inserisci la password utilizzata per creare il backup.'
      );
    }

    setBusy(true);

    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled) return;

      const asset = selection.assets?.[0];

      if (!asset?.uri) {
        throw new Error('Nessun file selezionato.');
      }

      const payload = await readEncryptedBackup(asset.uri, password);

      Alert.alert(
        'Conferma ripristino',
        'Il ripristino sostituirà i dati locali della boutique, del magazzino, delle finanze e gli account con quelli contenuti nel backup. Continuare?',
        [
          { text: 'ANNULLA', style: 'cancel' },
          {
            text: 'RIPRISTINA',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);

              try {
                await restoreBackup(payload);
                setPassword('');
                setConfirmation('');

                Alert.alert(
                  'Ripristino completato',
                  'Chiudi e riapri l’app per ricaricare tutti i dati e gli account.'
                );
              } catch (error) {
                Alert.alert(
                  'Ripristino non riuscito',
                  error?.message || 'Errore durante il ripristino.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Backup non valido',
        error?.message || 'Password errata o file danneggiato.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>BACKUP E RIPRISTINO</Text>
      <Text style={s.description}>
        Crea una copia cifrata dei dati locali e degli account.
        Conserva la password separatamente dal file.
      </Text>

      <Text style={s.label}>PASSWORD DEL BACKUP</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Almeno 12 caratteri"
        placeholderTextColor="#9A858B"
        secureTextEntry
        autoCapitalize="none"
        style={s.input}
        editable={!busy}
      />

      <Text style={s.label}>CONFERMA PASSWORD PER NUOVO BACKUP</Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Ripeti la password"
        placeholderTextColor="#9A858B"
        secureTextEntry
        autoCapitalize="none"
        style={s.input}
        editable={!busy}
      />

      <ActionButton
        title={busy ? 'OPERAZIONE IN CORSO...' : 'CREA BACKUP CIFRATO'}
        onPress={createBackup}
        disabled={busy}
      />

      <View style={s.separator} />

      <Text style={s.description}>
        Per ripristinare, inserisci la password del backup e seleziona il file
        .sfoxbackup. I dati attuali verranno sostituiti.
      </Text>

      <ActionButton
        title="SELEZIONA E RIPRISTINA BACKUP"
        onPress={importBackup}
        disabled={busy}
      />

      <Text style={s.note}>
        Il file è protetto con AES-256-GCM. La password non viene salvata
        nell’app.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDFC',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#EADFE0',
    marginTop: 12,
  },
  title: {
    color: '#21121B',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  description: {
    color: '#8B777E',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
    marginBottom: 12,
  },
  label: {
    color: '#895F38',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FBF6F2',
    borderWidth: 1,
    borderColor: '#EADFE0',
    borderRadius: 9,
    padding: 12,
    color: '#21121B',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3D1B2D',
    borderRadius: 22,
    padding: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#E7D4AC',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  separator: {
    height: 1,
    backgroundColor: '#EADFE0',
    marginVertical: 17,
  },
  note: {
    color: '#8B777E',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
});
