import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AGE_STORAGE_KEY = '@sabryfox_age_gate_v1';

function parseBirthDateAndCheckAdult(input) {
  const cleaned = String(input || '').trim();
  const match = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) {
    return { valid: false, reason: 'Inserisci la data di nascita nel formato GG/MM/AAAA (es. 15/06/1994).' };
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const now = new Date();
  const currentYear = now.getFullYear();

  if (year < 1910 || year > currentYear || month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, reason: 'La data di nascita inserita non è valida.' };
  }
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > now) {
    return { valid: false, reason: 'La data di nascita inserita non esiste nel calendario.' };
  }

  let age = currentYear - year;
  const mDiff = now.getMonth() - (month - 1);
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) {
    age--;
  }
  return { valid: true, isAdult: age >= 18, age };
}
import { fetchPublicCatalog, submitVisitorRequest } from './PublicStorefrontService';

const PALETTE = {
  dark: '#21121B',
  plum: '#3D1B2D',
  gold: '#C9A66B',
  light: '#E7D4AC',
  cream: '#FBF6F2',
  white: '#FFFDFC',
  muted: '#8B777E',
  line: '#EADFE0',
  red: '#9B4C50',
};

export default function PublicLingerieStorefront({ onExitStorefront, onAgeStatusChange }) {
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [ageVerified, setAgeVerified] = useState(false);
  const [underageBlocked, setUnderageBlocked] = useState(false);
  const [birthDateInput, setBirthDateInput] = useState('');
  const [ageError, setAgeError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [brokenImages, setBrokenImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [contactNote, setContactNote] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState(null);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const items = await fetchPublicCatalog();
      setCatalog(Array.isArray(items) ? items : []);
    } catch {
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(AGE_STORAGE_KEY);
        if (!active) return;
        if (saved === 'blocked') {
          setUnderageBlocked(true);
          if (typeof onAgeStatusChange === 'function') onAgeStatusChange('blocked');
        } else if (saved === 'verified') {
          setAgeVerified(true);
          if (typeof onAgeStatusChange === 'function') onAgeStatusChange('verified');
        }
      } catch {}
      if (active) setCheckingStorage(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ageVerified && !underageBlocked) {
      loadCatalog();
    }
  }, [ageVerified, underageBlocked]);

  const lockUnderageAccess = async () => {
    setUnderageBlocked(true);
    setAgeVerified(false);
    setCatalog([]);
    try {
      await AsyncStorage.setItem(AGE_STORAGE_KEY, 'blocked');
    } catch {}
    if (typeof onAgeStatusChange === 'function') {
      onAgeStatusChange('blocked');
    }
  };

  const handleConfirmBirthDate = async () => {
    const check = parseBirthDateAndCheckAdult(birthDateInput);
    if (!check.valid) {
      setAgeError(check.reason);
      return;
    }
    if (!check.isAdult) {
      setAgeError('Accesso negato: età inferiore a 18 anni.');
      await lockUnderageAccess();
      return;
    }
    setAgeError('');
    setAgeVerified(true);
    try {
      await AsyncStorage.setItem(AGE_STORAGE_KEY, 'verified');
    } catch {}
    if (typeof onAgeStatusChange === 'function') {
      onAgeStatusChange('verified');
    }
  };

  const setItemQty = (item, delta) => {
    const maxQty = Number(item.availableQty || 0);
    setQuantities((prev) => {
      const current = Number(prev[item.id] || 0);
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [item.id]: next };
    });
  };

  const selectedItems = catalog
    .map((item) => ({
      ...item,
      qty: Number(quantities[item.id] || 0),
    }))
    .filter((entry) => entry.qty > 0);

  const totalEstimated = selectedItems.reduce(
    (acc, entry) => acc + entry.qty * (Number(entry.price) || 0),
    0
  );

  const handleSubmitRequest = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Nessun capo selezionato', 'Seleziona almeno un articolo prima di inviare la richiesta.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitVisitorRequest({
        items: selectedItems,
        contactNote,
      });

      if (!res?.ok) {
        Alert.alert('Invio non riuscito', 'Controlla le quantità selezionate e riprova.');
        return;
      }

      setQuantities({});
      setContactNote('');
      setLastReceiptId(res.requestId);
      Alert.alert(
        'Richiesta inviata',
        `Richiesta registrata (#${String(res.requestId).slice(-6)}). La disponibilità sarà verificata in fase di conferma.`
      );
    } catch (e) {
      Alert.alert('Errore di invio', e?.message || 'Impossibile inviare la richiesta in questo momento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStorage) {
    return (
      <View style={styles.gateRoot}>
        <View style={styles.gateCard}>
          <Text style={styles.badge}>CONTROLLO ACCESSO 18+</Text>
          <Text style={styles.gateTitle}>Verifica requisiti in corso...</Text>
        </View>
      </View>
    );
  }

  if (underageBlocked) {
    return (
      <View style={styles.gateRoot}>
        <View style={styles.gateCard}>
          <Text style={styles.badge}>ACCESSO BLOCCATO · SOLO 18+</Text>
          <Text style={styles.gateTitle}>Contenuto vietato ai minori di 18 anni</Text>
          <Text style={styles.gateText}>
            La verifica dell'età ha rilevato un utente minorenne o non autorizzato. L'accesso alla vetrina adulti è stato bloccato su questo dispositivo.
          </Text>
          {Platform.OS === 'android' ? (
            <Pressable style={styles.primaryBtn} onPress={() => BackHandler.exitApp()}>
              <Text style={styles.primaryBtnText}>Chiudi applicazione</Text>
            </Pressable>
          ) : null}
          {typeof onExitStorefront === 'function' ? (
            <Pressable style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={onExitStorefront}>
              <Text style={styles.secondaryBtnText}>Esci dalla Vetrina 18+</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (!ageVerified) {
    return (
      <View style={styles.gateRoot}>
        <View style={styles.gateCard}>
          <Text style={styles.badge}>VETRINA ADULTI · VERIFICA OBBLIGATORIA 18+</Text>
          <Text style={styles.gateTitle}>Verifica reale maggiore età</Text>
          <Text style={styles.gateText}>
            L'accesso al catalogo lingerie e lingerie sexy di SabryFox2025 è consentito esclusivamente a persone maggiorenni (18+ anni compiuti). Inserisci la tua data di nascita reale:
          </Text>
          <TextInput
            value={birthDateInput}
            onChangeText={(txt) => {
              setBirthDateInput(txt);
              if (ageError) setAgeError('');
            }}
            placeholder="GG/MM/AAAA (es. 14/05/1992)"
            placeholderTextColor="#8B777E"
            keyboardType="numeric"
            maxLength={10}
            style={{
              backgroundColor: '#21121B',
              color: '#FFFDFC',
              borderWidth: 1,
              borderColor: ageError ? '#D96B70' : '#C9A66B',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              marginBottom: 10,
              textAlign: 'center',
            }}
          />
          {ageError ? (
            <Text style={{ color: '#F29B9E', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
              {ageError}
            </Text>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={handleConfirmBirthDate}>
            <Text style={styles.primaryBtnText}>Verifica data di nascita ed entra (18+)</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { marginTop: 10 }]}
            onPress={async () => {
              await lockUnderageAccess();
              if (typeof onExitStorefront === 'function') {
                onExitStorefront();
              }
            }}>
            <Text style={styles.secondaryBtnText}>Ho meno di 18 anni / Blocca ed Esci</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.badge}>SOLO MAGGIORENNI 18+</Text>
        <Text style={styles.title}>SabryFox2025 · Vetrina Lingerie</Text>
        <Text style={styles.subtitle}>
          Seleziona i capi disponibili e invia una richiesta di prenotazione/info.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable style={styles.smallBtn} disabled={loading} onPress={loadCatalog}>
            <Text style={styles.smallBtnText}>{loading ? 'Aggiornamento...' : 'Aggiorna catalogo'}</Text>
          </Pressable>
          {typeof onExitStorefront === 'function' ? (
            <Pressable style={styles.smallBtnOutline} onPress={onExitStorefront}>
              <Text style={styles.smallBtnOutlineText}>Accesso Gestionale</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {lastReceiptId ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Ultima richiesta inviata: #{String(lastReceiptId).slice(-6)}</Text>
          <Text style={styles.mutedText}>Stato: in attesa di verifica e conferma.</Text>
        </View>
      ) : null}

      {catalog.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {loading ? 'Caricamento vetrina...' : 'Nessun articolo disponibile al momento'}
          </Text>
          <Text style={styles.mutedText}>
            Il catalogo pubblico viene aggiornato dal gestionale con i capi disponibili a magazzino.
          </Text>
        </View>
      ) : (
        catalog.map((item) => {
          const qty = Number(quantities[item.id] || 0);
          const hasThumb = Boolean(item.imageUrl && !brokenImages[item.id]);
          return (
            <View key={item.id} style={styles.card}>
              <Image
                source={hasThumb ? { uri: item.imageUrl } : require('../../assets/logo.jpg')}
                style={styles.thumbImg}
                resizeMode={hasThumb ? 'cover' : 'contain'}
                onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
              />
              <Text style={styles.cardTitle}>{item.name || item.code}</Text>
              <Text style={styles.metaText}>
                {item.brand ? `${item.brand} · ` : ''}
                {item.category ? `${item.category} · ` : ''}
                {item.size ? `Taglia: ${item.size}` : ''}
                {item.color ? ` · Colore: ${item.color}` : ''}
              </Text>
              <Text style={styles.priceText}>
                {item.price > 0 ? `€ ${item.price.toFixed(2)}` : 'Prezzo su richiesta'} · Disp.: {item.availableQty}
              </Text>

              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => setItemQty(item, -1)}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </Pressable>
                <Text style={styles.qtyValue}>Selezionati: {qty}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => setItemQty(item, 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Riepilogo richiesta</Text>
        <Text style={styles.metaText}>
          Articoli selezionati: {selectedItems.reduce((sum, x) => sum + x.qty, 0)} · Totale indicativo: € {totalEstimated.toFixed(2)}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Nota o recapito facoltativo (es. preferenza contatto)"
          placeholderTextColor={PALETTE.muted}
          value={contactNote}
          onChangeText={setContactNote}
          maxLength={240}
        />
        <Pressable
          style={[styles.primaryBtn, (submitting || selectedItems.length === 0) && { opacity: 0.6 }]}
          disabled={submitting || selectedItems.length === 0}
          onPress={handleSubmitRequest}>
          <Text style={styles.primaryBtnText}>
            {submitting ? 'Invio richiesta...' : 'Invia richiesta'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gateRoot: {
    flex: 1,
    backgroundColor: PALETTE.dark,
    justifyContent: 'center',
    padding: 20,
  },
  gateCard: {
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: PALETTE.gold,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.plum,
    color: PALETTE.light,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.dark,
    marginBottom: 8,
  },
  gateText: {
    fontSize: 15,
    color: PALETTE.dark,
    lineHeight: 22,
    marginBottom: 16,
  },
  root: {
    flex: 1,
    backgroundColor: PALETTE.cream,
  },
  content: {
    padding: 14,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: PALETTE.dark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: PALETTE.light,
  },
  subtitle: {
    fontSize: 14,
    color: PALETTE.gold,
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  thumbImg: {
    width: '100%',
    height: 170,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: PALETTE.cream,
  },
  noticeCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.gold,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.plum,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.dark,
  },
  metaText: {
    fontSize: 13,
    color: PALETTE.muted,
    marginTop: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.plum,
    marginTop: 6,
  },
  mutedText: {
    fontSize: 13,
    color: PALETTE.muted,
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: PALETTE.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: PALETTE.white,
    fontSize: 18,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.dark,
  },
  input: {
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 12,
    fontSize: 14,
    color: PALETTE.dark,
    backgroundColor: PALETTE.cream,
  },
  primaryBtn: {
    backgroundColor: PALETTE.plum,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: PALETTE.plum,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: PALETTE.plum,
    fontSize: 14,
    fontWeight: '700',
  },
  smallBtn: {
    backgroundColor: PALETTE.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallBtnText: {
    color: PALETTE.dark,
    fontSize: 13,
    fontWeight: '700',
  },
  smallBtnOutline: {
    borderWidth: 1,
    borderColor: PALETTE.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallBtnOutlineText: {
    color: PALETTE.light,
    fontSize: 13,
    fontWeight: '700',
  },
});
