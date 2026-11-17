// Catalogo dimostrativo SabryFox2025. Prodotti, prezzi, colori e disponibilita sono fittizi.
// Le immagini sono fotografie rappresentative gia incluse nel progetto, non foto esatte dei singoli SKU.
export const DEMO_PRODUCTS = [
  {
    id: 'SF-DEMO-001', name: 'Reggiseno balconcino in pizzo', category: 'Reggiseni', price: 29.90,
    description: 'Bralette balconcino con coppe sagomate e dettagli in pizzo. Articolo dimostrativo.',
    material: 'Pizzo e microfibra', image: require('../../assets/catalogo-mercato/bra-black.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Avorio',hex:'#E9E0CF'},{name:'Bordeaux',hex:'#721F37'}],
    sizes: ['1B','2B','3B','4B','5B'], stock: 8
  },
  {
    id: 'SF-DEMO-002', name: 'Reggiseno morbido senza ferretto', category: 'Reggiseni', price: 24.90,
    description: 'Modello morbido da tutti i giorni, con spalline regolabili. Articolo dimostrativo.',
    material: 'Microfibra elasticizzata', image: require('../../assets/catalogo-mercato/bra-grey.jpg'),
    colors: [{name:'Grigio',hex:'#777777'},{name:'Nero',hex:'#171313'},{name:'Rosa cipria',hex:'#D9A6A5'}],
    sizes: ['1B','2B','3B','4B'], stock: 10
  },
  {
    id: 'SF-DEMO-003', name: 'Reggiseno push-up effetto seta', category: 'Reggiseni', price: 27.90,
    description: 'Coppe push-up con finitura liscia effetto seta. Articolo dimostrativo.',
    material: 'Microfibra liscia', image: require('../../assets/catalogo-mercato/bra-display.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Nude',hex:'#C99E83'},{name:'Bianco',hex:'#F4F1EB'}],
    sizes: ['1B','2B','3B','4B'], stock: 7
  },
  {
    id: 'SF-DEMO-004', name: 'Reggiseno seamless', category: 'Reggiseni', price: 22.90,
    description: 'Modello senza cuciture evidenti, pensato per una vestibilita discreta. Articolo dimostrativo.',
    material: 'Microfibra seamless', image: require('../../assets/catalogo-mercato/bra-seamless.jpg'),
    colors: [{name:'Nude',hex:'#C99E83'},{name:'Nero',hex:'#171313'},{name:'Cioccolato',hex:'#68432F'}],
    sizes: ['S','M','L','XL'], stock: 12
  },
  {
    id: 'SF-DEMO-005', name: 'Body in pizzo floreale', category: 'Body', price: 39.90,
    description: 'Body intero con disegno floreale e finiture curate. Articolo dimostrativo.',
    material: 'Pizzo elasticizzato', image: require('../../assets/catalogo-mercato/corset-red.jpg'),
    colors: [{name:'Rosso',hex:'#9D1D35'},{name:'Nero',hex:'#171313'}],
    sizes: ['S','M','L','XL'], stock: 5
  },
  {
    id: 'SF-DEMO-006', name: 'Body modellante in tulle', category: 'Body', price: 34.90,
    description: 'Body leggero con inserti in tulle e linea essenziale. Articolo dimostrativo.',
    material: 'Tulle e microfibra', image: require('../../assets/catalogo-mercato/corset-historic.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Nude',hex:'#C99E83'}],
    sizes: ['S','M','L','XL'], stock: 6
  },
  {
    id: 'SF-DEMO-007', name: 'Slip classico in microfibra', category: 'Slip e culotte', price: 8.90,
    description: 'Slip classico con bordi morbidi e vestibilita confortevole. Articolo dimostrativo.',
    material: 'Microfibra', image: require('../../assets/catalogo-mercato/panties-brown.jpg'),
    colors: [{name:'Cioccolato',hex:'#68432F'},{name:'Nero',hex:'#171313'},{name:'Avorio',hex:'#E9E0CF'}],
    sizes: ['S','M','L','XL'], stock: 20
  },
  {
    id: 'SF-DEMO-008', name: 'Culotte a vita alta', category: 'Slip e culotte', price: 12.90,
    description: 'Culotte a vita alta con linea avvolgente. Articolo dimostrativo.',
    material: 'Microfibra elasticizzata', image: require('../../assets/catalogo-mercato/panties-brown.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Bordeaux',hex:'#721F37'},{name:'Nude',hex:'#C99E83'}],
    sizes: ['S','M','L','XL'], stock: 14
  },
  {
    id: 'SF-DEMO-009', name: 'Brasiliana in pizzo', category: 'Slip e culotte', price: 10.90,
    description: 'Brasiliana con inserto in pizzo e retro sagomato. Articolo dimostrativo.',
    material: 'Pizzo e microfibra', image: require('../../assets/catalogo-mercato/panties-brown.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Rosso',hex:'#9D1D35'},{name:'Rosa cipria',hex:'#D9A6A5'}],
    sizes: ['S','M','L','XL'], stock: 16
  },
  {
    id: 'SF-DEMO-010', name: 'Tanga invisibile', category: 'Slip e culotte', price: 7.90,
    description: 'Tanga leggero con bordi piatti. Articolo dimostrativo.',
    material: 'Microfibra liscia', image: require('../../assets/catalogo-mercato/panties-brown.jpg'),
    colors: [{name:'Nude',hex:'#C99E83'},{name:'Nero',hex:'#171313'},{name:'Bianco',hex:'#F4F1EB'}],
    sizes: ['S','M','L','XL'], stock: 18
  },
  {
    id: 'SF-DEMO-011', name: 'Corsetto elegante', category: 'Corsetteria', price: 44.90,
    description: 'Corsetto decorativo con stecche e chiusura posteriore. Articolo dimostrativo.',
    material: 'Raso e inserti in pizzo', image: require('../../assets/catalogo-mercato/corset-red.jpg'),
    colors: [{name:'Rosso',hex:'#9D1D35'},{name:'Nero',hex:'#171313'}],
    sizes: ['S','M','L'], stock: 4
  },
  {
    id: 'SF-DEMO-012', name: 'Reggicalze in pizzo', category: 'Reggicalze e calze', price: 16.90,
    description: 'Reggicalze con cinturini regolabili e dettagli in pizzo. Articolo dimostrativo.',
    material: 'Pizzo elasticizzato', image: require('../../assets/catalogo-mercato/garter-belt.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Rosso',hex:'#9D1D35'}],
    sizes: ['S','M','L','XL'], stock: 6
  },
  {
    id: 'SF-DEMO-013', name: 'Calze autoreggenti velate', category: 'Reggicalze e calze', price: 13.90,
    description: 'Calze velate con fascia superiore decorata. Articolo dimostrativo.',
    material: 'Poliammide elasticizzata', image: require('../../assets/catalogo-mercato/stockings-met.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Naturale',hex:'#D5B29A'}],
    sizes: ['1/2','3/4'], stock: 9
  },
  {
    id: 'SF-DEMO-014', name: 'Completo coordinato in pizzo', category: 'Completi', price: 49.90,
    description: 'Completo dimostrativo composto da reggiseno e slip coordinato.',
    material: 'Pizzo e microfibra', image: require('../../assets/catalogo-mercato/bra-black.jpg'),
    colors: [{name:'Nero',hex:'#171313'},{name:'Bordeaux',hex:'#721F37'}],
    sizes: ['S','M','L'], stock: 5
  }
];

export const DEMO_CATEGORIES = ['Tutti', 'Reggiseni', 'Body', 'Slip e culotte', 'Corsetteria', 'Reggicalze e calze', 'Completi'];

// Tutte le opzioni seguenti sono visibili SOLO in modalità dimostrativa.
// In produzione ogni metodo dipende da gateway, paese, contratto e abilitazione del merchant.
export const DEMO_PAYMENT_GROUPS = [
  {
    title: 'CARTE DI PAGAMENTO',
    methods: [
      { id: 'visa', label: 'Visa / Visa Debit · DEMO', hint: 'Nexi XPay · Stripe · Shopify Payments' },
      { id: 'mastercard', label: 'Mastercard · DEMO', hint: 'Nexi XPay · Stripe · Shopify Payments' },
      { id: 'maestro', label: 'Maestro · DEMO', hint: 'Nexi XPay · Shopify Payments' },
      { id: 'vpay', label: 'V Pay · DEMO', hint: 'Nexi XPay · disponibilità da contratto' },
      { id: 'amex', label: 'American Express · DEMO', hint: 'Nexi XPay · Stripe · Shopify Payments; attivazione secondo contratto' },
      { id: 'jcb', label: 'JCB · DEMO', hint: 'Nexi XPay · attivazione secondo contratto' },
      { id: 'unionpay', label: 'UnionPay · DEMO', hint: 'Nexi XPay · Shopify Payments' },
      { id: 'diners', label: 'Diners Club / Discover · DEMO', hint: 'Disponibilità da verificare con l’acquirer' }
    ]
  },
  {
    title: 'WALLET E CHECKOUT VELOCI',
    methods: [
      { id: 'apple-pay', label: 'Apple Pay · DEMO', hint: 'Nexi XPay · Stripe · Shopify Payments; dispositivo compatibile' },
      { id: 'google-pay', label: 'Google Pay · DEMO', hint: 'Nexi XPay · Stripe · Shopify Payments; dispositivo compatibile' },
      { id: 'paypal', label: 'PayPal · DEMO', hint: 'Nexi XPay o integrazione PayPal dedicata' },
      { id: 'amazon-pay', label: 'Amazon Pay · DEMO', hint: 'Nexi XPay · attivazione richiesta' },
      { id: 'shop-pay', label: 'Shop Pay · DEMO', hint: 'Shopify Payments / negozio Shopify' },
      { id: 'stripe-link', label: 'Link by Stripe · DEMO', hint: 'Stripe Checkout; disponibilità secondo account' },
      { id: 'skrill', label: 'Skrill · DEMO', hint: 'Nexi XPay · attivazione richiesta' },
      { id: 'skrill-1tap', label: 'Skrill 1-Tap · DEMO', hint: 'Nexi XPay · attivazione richiesta' },
      { id: 'alipay', label: 'Alipay · DEMO', hint: 'Nexi XPay · Stripe; mercato e contratto' },
      { id: 'wechat-pay', label: 'WeChat Pay · DEMO', hint: 'Nexi XPay · mercato e contratto' }
    ]
  },
  {
    title: 'PAGAMENTI LOCALI E DIRETTI DA CONTO',
    methods: [
      { id: 'satispay', label: 'Satispay · DEMO', hint: 'Nexi XPay · Shopify Payments in Italia, se abilitato' },
      { id: 'bancomat-pay', label: 'BANCOMAT Pay · DEMO', hint: 'Nexi XPay · Italia; attivazione da back office' },
      { id: 'mybank', label: 'MyBank · DEMO', hint: 'Nexi XPay · Italia' },
      { id: 'pay-by-bank', label: 'Pay by Bank / bonifico immediato · DEMO', hint: 'Nexi XPay o provider A2A compatibile' },
      { id: 'sepa-dd', label: 'Addebito diretto SEPA · DEMO', hint: 'Stripe o provider SEPA; mandato richiesto' },
      { id: 'ideal-wero', label: 'iDEAL / Wero · DEMO', hint: 'Nexi XPay · Stripe · Shopify per clienti idonei' },
      { id: 'bancontact', label: 'Bancontact · DEMO', hint: 'Nexi XPay · Stripe · Shopify per clienti in Belgio' },
      { id: 'eps', label: 'EPS · DEMO', hint: 'Nexi XPay · clienti in Austria' },
      { id: 'p24', label: 'Przelewy24 · DEMO', hint: 'Nexi XPay · clienti in Polonia' },
      { id: 'blik', label: 'BLIK · DEMO', hint: 'Nexi XPay · clienti in Polonia' },
      { id: 'multibanco', label: 'Multibanco · DEMO', hint: 'Nexi XPay · clienti in Portogallo' },
      { id: 'mobilepay', label: 'MobilePay · DEMO', hint: 'Disponibilità Nord Europa e provider' },
      { id: 'twint', label: 'TWINT · DEMO', hint: 'Nexi / Shopify o provider compatibile; Svizzera' },
      { id: 'mbway', label: 'MB WAY · DEMO', hint: 'Shopify o provider compatibile; Portogallo' },
      { id: 'bizum', label: 'Bizum · DEMO', hint: 'Provider compatibile; Spagna' }
    ]
  },
  {
    title: 'PAGAMENTI A RATE',
    methods: [
      { id: 'klarna', label: 'Klarna · DEMO', hint: 'Nexi XPay · Shopify Payments · provider compatibile' },
      { id: 'paypal-3', label: 'PayPal Paga in 3 · DEMO', hint: 'Nexi XPay / PayPal; soggetto ad approvazione' },
      { id: 'oney', label: 'Oney · DEMO', hint: 'Nexi XPay; attivazione e requisiti del merchant' },
      { id: 'pagodil', label: 'PagoDIL · DEMO', hint: 'Nexi XPay; attivazione e requisiti del merchant' },
      { id: 'heylight', label: 'HeyLight · DEMO', hint: 'Nexi XPay; attivazione e requisiti del merchant' },
      { id: 'afterpay', label: 'Afterpay / Clearpay · DEMO', hint: 'Provider dedicato e paesi supportati' }
    ]
  },
  {
    title: 'ALTRI METODI',
    methods: [
      { id: 'usdc', label: 'USDC · DEMO', hint: 'Opzione crypto solo se provider, paese e requisiti la consentono' },
      { id: 'bank-transfer', label: 'Bonifico bancario tradizionale · DEMO', hint: 'Conferma manuale dell’accredito' },
      { id: 'cash-on-delivery', label: 'Contrassegno · DEMO', hint: 'Pagamento al corriere; accordo con il vettore' }
    ]
  }
];

export const DEMO_PAYMENT_METHODS = DEMO_PAYMENT_GROUPS.flatMap(group => group.methods.map(method => method.label));

export const DEMO_ORDERS_KEY = '@sabryfox/demo/orders';
