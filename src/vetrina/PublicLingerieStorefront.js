import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

export default function PublicLingerieStorefront({ onExitStorefront }) {
  const [ageVerified, setAgeVerified] = useState(false);
  const [underageBlocked, setUnderageBlocked] = useState(false);
  const [catalog, setCatalog] = useState([]);
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
    if (ageVerified) {
      loadCatalog();
    }
  }, [ageVerified]);

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

  if (underageBlocked) {
    return (
      <View style={styles.gateRoot}>
        <View style={styles.gateCard}>
          <Text style={styles.badge}>CONTENUTO RISERVATO 18+</Text>
          <Text style={styles.gateTitle}>Accesso non consentito</Text>
          <Text style={styles.gateText}>
            Questa vetrina è destinata esclusivamente a un pubblico maggiorenne.
          </Text>
          {typeof onExitStorefront === 'function' ? (
            <Pressable style={styles.primaryBtn} onPress={onExitStorefront}>
              <Text style={styles.primaryBtnText}>Torna all'avvio</Text>
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
          <Text style={styles.badge}>VETRINA ADULTI · 18+</Text>
          <Text style={styles.gateTitle}>Verifica maggiore età</Text>
          <Text style={styles.gateText}>
            L'accesso al catalogo lingerie di SabryFox2025 è riservato esclusivamente a persone di età pari o superiore a 18 anni.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setAgeVerified(true)}>
            <Text style={styles.primaryBtnText}>Confermo di avere almeno 18 anni</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { marginTop: 10 }]}
            onPress={() => {
              if (typeof onExitStorefront === 'function') {
                onExitStorefront();
              } else {
                setUnderageBlocked(true);
              }
            }}>
            <Text style={styles.secondaryBtnText}>Ho meno di 18 anni / Esci</Text>
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
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.name || item.code}</Text>
              <Text style={styles.metaText}>
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
