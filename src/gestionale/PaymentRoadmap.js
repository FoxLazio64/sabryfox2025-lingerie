// Configurazione descrittiva per l'integrazione futura.
// Non contiene chiavi segrete e non attiva pagamenti: i segreti devono restare su un backend sicuro.
export const PAYMENT_PRODUCTION_PLAN = {
  mode: 'demo',
  livePaymentsEnabled: false,
  primaryProvider: 'Nexi XPay',
  reason: 'Nexi documenta oltre 30 metodi di pagamento e integrazioni per e-commerce/app. La disponibilità effettiva dipende dal contratto e dall’attivazione del merchant.',
  alternativeProviders: ['Stripe', 'PayPal', 'Shopify Payments'],
  backendRequired: true,
  requiredBeforeGoLive: [
    'account merchant verificato e contratto del provider',
    'backend HTTPS per creare le sessioni di pagamento',
    'chiavi API conservate sul server, mai nell’APK',
    'webhook firmati per confermare pagamenti, rimborsi e annulli',
    'test in sandbox, autenticazione forte 3-D Secure/SCA e passaggio alla produzione'
  ]
};
