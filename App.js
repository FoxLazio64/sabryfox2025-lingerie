import React, { useState } from 'react';
import { StatusBar, View, Pressable, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';
import PublicLingerieStorefront from './src/vetrina/PublicLingerieStorefront';
import EcommerceStoreView from './src/ecommerce/EcommerceStoreView';

const STAFF_ROLES = ['Amministratore unico', 'Amministrazione e Finanze', 'Dipendenti'];

function SessionWorkspace({ session }) {
  const isStaff = STAFF_ROLES.includes(session?.role);
  const isVip = session?.role === 'Clienti VIP';
  const [previewStore, setPreviewStore] = useState(false);

  if (!session) return null;

  if (!isStaff) {
    return <EcommerceStoreView session={session} isVip={isVip} />;
  }

  if (previewStore) {
    return (
      <View style={{ flex: 1, backgroundColor: '#21121B' }}>
        <EcommerceStoreView
          session={session}
          isVip={true}
          onOpenBackoffice={() => setPreviewStore(false)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#21121B' }}>
      <View style={s.topBar}>
        <Text style={s.topBarText}>Ruolo attivo: {session.role}</Text>
        <Pressable style={s.shopBtn} onPress={() => setPreviewStore(true)}>
          <Text style={s.shopBtnText}>Apri E-Commerce</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <ManagementDashboard session={session} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2E1523',
    borderBottomWidth: 1,
    borderBottomColor: '#6A3A50',
  },
  topBarText: {
    color: '#E7D4AC',
    fontSize: 12,
    fontWeight: '600',
  },
  shopBtn: {
    backgroundColor: '#C9A66B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shopBtnText: {
    color: '#21121B',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default function App() {
  const [showPublicStorefront, setShowPublicStorefront] = useState(false);

  if (showPublicStorefront) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#21121B" />
        <PublicLingerieStorefront onExitStorefront={() => setShowPublicStorefront(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#21121B"
      />
      <Pressable
        onPress={() => setShowPublicStorefront(true)}
        style={{
          backgroundColor: '#3D1B2D',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#C9A66B',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#E7D4AC', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
          APRI VETRINA PUBBLICA (18+)
        </Text>
      </Pressable>
      <AuthGate>
        {(session) => <SessionWorkspace session={session} />}
      </AuthGate>
    </SafeAreaProvider>
  );
}
