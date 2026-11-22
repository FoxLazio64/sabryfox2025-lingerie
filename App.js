import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import database from '@react-native-firebase/database';

import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';

function VipCatalogView({ session }) {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('Caricamento catalogo VIP...');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await database().ref('vipCatalog').once('value');
        const val = snap.val();
        if (!active) return;
        if (!val) {
          setItems([]);
          setMsg('Catalogo VIP pronto: nessun capo pubblicato al momento.');
        } else {
          const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
          setItems(list);
          setMsg('');
        }
      } catch (e) {
        if (active) setMsg('Impossibile leggere il catalogo VIP al momento.');
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <ScrollView style={vipStyles.page} contentContainerStyle={vipStyles.container}>
      <Image source={require('./assets/logo.jpg')} style={vipStyles.logo} resizeMode="contain" />
      <Text style={vipStyles.title}>AREA CLIENTI VIP</Text>
      <Text style={vipStyles.sub}>Benvenuta/o, {session?.name || session?.username}</Text>
      {msg ? <Text style={vipStyles.copy}>{msg}</Text> : null}
      {items.map((item, idx) => (
        <View key={item?.id || idx} style={vipStyles.card}>
          <Text style={vipStyles.cardTitle}>{item?.name || item?.title || `Capo VIP ${idx + 1}`}</Text>
          {item?.price != null ? <Text style={vipStyles.cardPrice}>€ {item.price}</Text> : null}
          {item?.description ? <Text style={vipStyles.copy}>{item.description}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const vipStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#21121B' },
  container: { padding: 18 },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: 10 },
  title: { color: '#E7D4AC', fontSize: 20, textAlign: 'center', fontFamily: 'Georgia', letterSpacing: 1.5 },
  sub: { color: '#C9A66B', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  copy: { color: '#D5C1C6', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { backgroundColor: '#3D1B2D', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#C9A66B' },
  cardTitle: { color: '#FFFDFC', fontSize: 15, fontWeight: '700' },
  cardPrice: { color: '#C9A66B', fontSize: 13, marginTop: 4, fontWeight: '700' },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#21121B"
      />
      <AuthGate>
        {(session) => {
          if (!session) return null;
          if (['Amministratore unico', 'Amministrazione e Finanze', 'Dipendenti'].includes(session.role)) {
            return <ManagementDashboard session={session} />;
          }
          if (session.role === 'Clienti VIP') {
            return <VipCatalogView session={session} />;
          }
          return null;
        }}
      </AuthGate>
    </SafeAreaProvider>
  );
}
