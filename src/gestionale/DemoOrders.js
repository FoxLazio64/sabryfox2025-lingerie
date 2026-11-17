import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_ORDERS_KEY } from './DemoCatalog';

const C = '#123D30';
const DARK = '#08291F';
const money = (n) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;
const statuses = ['Nuovo - demo', 'In preparazione demo', 'Spedito demo', 'Completato demo', 'Annullato demo'];

export default function DemoOrders() {
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DEMO_ORDERS_KEY);
      setOrders(raw ? JSON.parse(raw) : []);
    } catch (e) {
      Alert.alert('Ordini demo', 'Non è stato possibile leggere gli ordini salvati.');
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    const next = orders.map(o => o.id === id ? { ...o, status } : o);
    setOrders(next);
    try { await AsyncStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(next)); }
    catch (e) { Alert.alert('Errore', 'Stato non salvato.'); load(); }
  }

  function clearOrders() {
    Alert.alert('Eliminare gli ordini demo?', 'Questa operazione cancella soltanto gli ordini fittizi di prova.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem(DEMO_ORDERS_KEY);
        setOrders([]);
      }}
    ]);
  }

  if (loading) return <View style={s.wrap}><Text style={s.muted}>Caricamento ordini dimostrativi...</Text></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={s.title}>Ordini dimostrativi</Text>
      <Text style={s.subtitle}>Ordini creati dal checkout di prova della boutique. Nessun pagamento reale.</Text>
      <View style={s.summary}><Text style={s.summaryNumber}>{orders.length}</Text><Text style={s.summaryText}>ORDINI DEMO REGISTRATI</Text></View>
      {!orders.length ? <Text style={s.empty}>Non ci sono ancora ordini. Accedi alla boutique come Cliente, aggiungi un capo e completa il checkout demo.</Text> : null}
      {orders.map(order => (
        <View key={order.id} style={s.card}>
          <View style={s.topLine}><Text style={s.orderNo}>{order.number}</Text><Text style={s.total}>{money(order.total)}</Text></View>
          <Text style={s.customer}>{order.customer?.name || 'Cliente demo'}</Text>
          <Text style={s.info}>{[order.customer?.address, order.customer?.postalCode, order.customer?.city].filter(Boolean).join(' · ')}</Text>
          {order.customer?.email ? <Text style={s.info}>{order.customer.email}</Text> : null}
          <View style={s.separator} />
          {(order.items || []).map((item, index) => <Text key={`${order.id}-${index}`} style={s.item}>• {item.qty} × {item.name} — {item.size}, {item.color} ({money(item.unitPrice)})</Text>)}
          <Text style={s.info}>Pagamento scelto: {order.paymentMethod}</Text>
          <Text style={s.noPayment}>SIMULAZIONE · NESSUN ADDEBITO</Text>
          <Text style={s.statusLabel}>STATO ORDINE</Text>
          <View style={s.statusRow}>
            {statuses.map(status => <Pressable key={status} onPress={() => updateStatus(order.id, status)} style={[s.statusButton, order.status === status && s.statusActive]}><Text style={[s.statusText, order.status === status && s.statusTextActive]}>{status.replace(' demo', '')}</Text></Pressable>)}
          </View>
        </View>
      ))}
      {orders.length > 0 ? <Pressable onPress={clearOrders} style={s.clear}><Text style={s.clearText}>CANCELLA TUTTI GLI ORDINI DIMOSTRATIVI</Text></Pressable> : null}
      <Pressable onPress={load} style={s.refresh}><Text style={s.refreshText}>AGGIORNA ELENCO</Text></Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 14 },
  title: { color: DARK, fontSize: 23, fontWeight: '900' },
  subtitle: { color: '#696960', fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  summary: { backgroundColor: DARK, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
  summaryNumber: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, summaryText: { color: '#E5D2AC', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  empty: { color: '#6F7069', fontSize: 13, lineHeight: 20, padding: 18, textAlign: 'center', backgroundColor: '#F5F1E8', borderRadius: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: '#E6DED1' },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, orderNo: { color: C, fontWeight: '900', fontSize: 13, flex: 1 }, total: { color: DARK, fontWeight: '900', fontSize: 15 },
  customer: { color: DARK, fontWeight: '800', fontSize: 14, marginTop: 8 }, info: { color: '#77766F', fontSize: 11, lineHeight: 16, marginTop: 3 },
  separator: { height: 1, backgroundColor: '#E7E0D5', marginVertical: 9 }, item: { color: '#4F5049', fontSize: 11, lineHeight: 17, marginBottom: 3 },
  noPayment: { color: '#A14C36', fontSize: 10, fontWeight: '900', marginTop: 7 }, statusLabel: { color: '#927447', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 12, marginBottom: 7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, statusButton: { paddingVertical: 7, paddingHorizontal: 9, borderRadius: 20, backgroundColor: '#F0ECE4', borderWidth: 1, borderColor: '#DDD5C8' },
  statusActive: { backgroundColor: C, borderColor: C }, statusText: { color: '#55564F', fontSize: 9, fontWeight: '700' }, statusTextActive: { color: '#FFFFFF' },
  clear: { backgroundColor: '#8A2E2E', borderRadius: 9, padding: 13, alignItems: 'center', marginTop: 5 }, clearText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  refresh: { alignSelf: 'center', padding: 12 }, refreshText: { color: C, fontWeight: '900', fontSize: 11 }, muted: { color: '#77766F' }
});
