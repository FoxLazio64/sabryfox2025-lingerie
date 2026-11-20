import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#21121B"
      />
      <AuthGate>
        {(session) => (
          session?.role === 'Amministratore unico'
            ? <ManagementDashboard session={session} />
            : null
        )}
      </AuthGate>
    </SafeAreaProvider>
  );
}
