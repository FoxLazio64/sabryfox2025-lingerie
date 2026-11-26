import React, { useState } from 'react';
import { StatusBar, View, Pressable, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';
import PublicLingerieStorefront from './src/vetrina/PublicLingerieStorefront';
import EcommerceStoreView from './src/ecommerce/EcommerceStoreView';

const STAFF_ROLES = ['Amministratore unico', 'Amministrazione e Finanze', 'Dipendenti'];

export default function App() {
  const [showPublicStorefront, setShowPublicStorefront] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [session, setSession] = useState(null);
  const [forceStoreView, setForceStoreView] = useState(false);

  const isStaff = STAFF_ROLES.includes(session?.role);
  const isVip = session?.role === 'Clienti VIP';

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
      <StatusBar barStyle="light-content" backgroundColor="#21121B" />

      <View style={s.topBar}>
        <Pressable style={s.linkBtn} onPress={() => setShowPublicStorefront(true)}>
          <Text style={s.linkBtnText}>Vetrina 18+</Text>
        </Pressable>

        {session ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.topBarText}>{session.role}</Text>
            {isStaff && !forceStoreView ? (
              <Pressable style={s.shopBtn} onPress={() => setForceStoreView(true)}>
                <Text style={s.shopBtnText}>Apri E-Commerce</Text>
              </Pressable>
            ) : null}
            {isStaff && forceStoreView ? (
              <Pressable style={s.shopBtn} onPress={() => setForceStoreView(false)}>
                <Text style={s.shopBtnText}>Gestionale</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable style={s.shopBtn} onPress={() => setShowAuthModal(true)}>
            <Text style={s.shopBtnText}>Accedi / Area Riservata</Text>
          </Pressable>
        )}
      </View>

      {session && isStaff && !forceStoreView ? (
        <View style={{ flex: 1, backgroundColor: '#21121B' }}>
          <ManagementDashboard session={session} />
        </View>
      ) : null}

      <View
        style={{
          flex: 1,
          backgroundColor: '#21121B',
          display:
            (session && isStaff && !forceStoreView) || showAuthModal ? 'none' : 'flex',
        }}
      >
        <EcommerceStoreView
          session={session}
          isVip={isVip || isStaff}
          onOpenBackoffice={isStaff ? () => setForceStoreView(false) : null}
          onRequestLogin={() => setShowAuthModal(true)}
        />
      </View>

      {showAuthModal ? (
        <View style={{ flex: 1, backgroundColor: '#21121B' }}>
          <View style={s.authHeader}>
            <Pressable style={s.linkBtn} onPress={() => setShowAuthModal(false)}>
              <Text style={s.linkBtnText}>← Torna al Negozio</Text>
            </Pressable>
          </View>
          <AuthGate>
            {(authenticatedSession) => {
              if (authenticatedSession && authenticatedSession !== session) {
                setTimeout(() => {
                  setSession(authenticatedSession);
                  setShowAuthModal(false);
                }, 0);
              }
              return null;
            }}
          </AuthGate>
        </View>
      ) : null}
    </SafeAreaProvider>
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
  linkBtn: {
    borderWidth: 1,
    borderColor: '#C9A66B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  linkBtnText: {
    color: '#E7D4AC',
    fontSize: 12,
    fontWeight: '700',
  },
  authHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2E1523',
    borderBottomWidth: 1,
    borderBottomColor: '#6A3A50',
    alignItems: 'flex-start',
  },
});
