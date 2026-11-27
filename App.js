import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StatusBar,
  View,
  Pressable,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';
import PublicLingerieStorefront from './src/vetrina/PublicLingerieStorefront';
import EcommerceStoreView from './src/ecommerce/EcommerceStoreView';

const STAFF_ROLES = ['Amministratore unico', 'Amministrazione e Finanze', 'Dipendenti'];

function AppShell() {
  const insets = useSafeAreaInsets();
  const [showPublicStorefront, setShowPublicStorefront] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [session, setSession] = useState(null);
  const [forceStoreView, setForceStoreView] = useState(false);
  const [ageGateStatus, setAgeGateStatus] = useState('unverified');

  useEffect(() => {
    AsyncStorage.getItem('@sabryfox_age_gate_v1')
      .then((val) => {
        if (val === 'blocked' || val === 'verified') setAgeGateStatus(val);
      })
      .catch(() => {});
  }, []);
  const appVersion = Constants.expoConfig?.version || "1.0.17";

  const isStaff = STAFF_ROLES.includes(session?.role);
  const isVip = session?.role === 'Clienti VIP';

  if (showPublicStorefront) {
    return (
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: '#21121B',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor="#21121B" />
        <PublicLingerieStorefront onExitStorefront={() => setShowPublicStorefront(false)} onAgeStatusChange={(st) => setAgeGateStatus(st)} />
        <View style={s.versionFooter}>
          <Text style={s.versionText}>v{appVersion}</Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#21121B',
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#21121B" />

      <View style={[s.topBar, { paddingTop: Math.max(8, insets.top + 4) }]}>
        {ageGateStatus !== 'blocked' ? (
          <Pressable style={s.linkBtn} onPress={() => setShowPublicStorefront(true)}>
            <Text style={s.linkBtnText}>Vetrina 18+</Text>
          </Pressable>
        ) : (
          <View style={[s.linkBtn, { opacity: 0.5 }]}>
            <Text style={s.linkBtnText}>18+ Bloccato</Text>
          </View>
        )}

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

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#21121B' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            isAdultVerified={isVip || isStaff || ageGateStatus === 'verified'}
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
      </KeyboardAvoidingView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  versionFooter: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#21121B',
    alignItems: 'flex-end',
  },
  versionText: {
    color: '#B89AA8',
    fontSize: 11,
  },
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
