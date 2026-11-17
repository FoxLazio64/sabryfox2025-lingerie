import React from 'react';
import {
  Alert, Image, Modal, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_PRODUCTS, DEMO_CATEGORIES, DEMO_PAYMENT_METHODS, DEMO_PAYMENT_GROUPS, DEMO_ORDERS_KEY } from './DemoCatalog';
import { PAYMENT_PRODUCTION_PLAN } from './PaymentRoadmap';

const C = '#123D30';
const DARK = '#08291F';
const GOLD = '#C8A86A';
const CREAM = '#F5F1E8';
const money = (n) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

export default function DemoShop({ session }) {
  const [category, setCategory] = React.useState('Tutti');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [selectedSize, setSelectedSize] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState('');
  const [cart, setCart] = React.useState([]);
  const [screen, setScreen] = React.useState('catalog');
  const [payment, setPayment] = React.useState(DEMO_PAYMENT_METHODS[0]);
  const [customerName, setCustomerName] = React.useState(session?.name || 'Cliente demo');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [lastOrder, setLastOrder] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const filtered = DEMO_PRODUCTS.filter(p =>
    (category === 'Tutti' || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
  );
  const cartDetails = cart.map(line => ({
    ...line,
    product: DEMO_PRODUCTS.find(p => p.id === line.productId)
  })).filter(x => x.product);
  const quantity = cart.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cartDetails.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const shipping = subtotal === 0 || subtotal >= 59 ? 0 : 4.90;
  const total = subtotal + shipping;

  function openProduct(product) {
    setSelected(product);
    setSelectedSize(product.sizes[0]);
    setSelectedColor(product.colors[0].name);
  }

  function addToCart() {
    if (!selected || !selectedSize || !selectedColor) {
      Alert.alert('Seleziona le varianti', 'Scegli colore e taglia prima di aggiungere il capo.');
      return;
    }
    setCart(prev => {
      const key = `${selected.id}|${selectedSize}|${selectedColor}`;
      const found = prev.find(x => x.key === key);
      if (found) return prev.map(x => x.key === key ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { key, productId: selected.id, size: selectedSize, color: selectedColor, qty: 1 }];
    });
    setSelected(null);
    Alert.alert('Aggiunto al carrello', 'Articolo dimostrativo aggiunto. Nessun acquisto è stato effettuato.');
  }

  function changeQty(key, delta) {
    setCart(prev => prev.map(x => x.key === key ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0));
  }

  async function confirmDemoOrder() {
    if (!cartDetails.length) {
      Alert.alert('Carrello vuoto', 'Aggiungi almeno un prodotto dimostrativo.');
      return;
    }
    if (!customerName.trim() || !address.trim() || !city.trim() || !postalCode.trim()) {
      Alert.alert('Dati mancanti', 'Inserisci nome, indirizzo, città e CAP per provare il checkout.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(DEMO_ORDERS_KEY);
      const orders = raw ? JSON.parse(raw) : [];
      const number = `SF-DEMO-${String(Date.now()).slice(-7)}`;
      const order = {
        id: number,
        number,
        createdAt: new Date().toISOString(),
        customer: { name: customerName.trim(), email: email.trim(), address: address.trim(), city: city.trim(), postalCode: postalCode.trim() },
        items: cartDetails.map(line => ({
          productId: line.product.id, name: line.product.name, imageId: line.product.id,
          size: line.size, color: line.color, qty: line.qty, unitPrice: line.product.price
        })),
        subtotal,
        shipping,
        total,
        paymentMethod: payment,
        status: 'Nuovo - demo',
        paymentStatus: 'SIMULAZIONE - NESSUN PAGAMENTO ESEGUITO',
        demo: true
      };
      await AsyncStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify([order, ...orders]));
      setLastOrder(order);
      setCart([]);
      setScreen('success');
    } catch (error) {
      Alert.alert('Errore nel salvataggio', 'Non sono riuscito a salvare l’ordine di prova. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  const Header = () => (
    <View style={s.header}>
      <View style={s.brandRow}>
        <Image source={require('../../assets/logo.jpg')} style={s.logo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>SabryFox2025</Text>
          <Text style={s.brandSub}>LINGERIE BOUTIQUE</Text>
        </View>
        <Pressable style={s.cartButton} onPress={() => setScreen('cart')}>
          <Text style={s.cartIcon}>🛍</Text>
          <Text style={s.cartCount}>{quantity}</Text>
        </Pressable>
      </View>
      <View style={s.demoBanner}><Text style={s.demoBannerText}>NEGOZIO DIMOSTRATIVO · PRODOTTI E PREZZI FITTIZI · NESSUN ADDEBITO</Text></View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <Header />
      {screen === 'catalog' ? (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.eyebrow}>LA BOUTIQUE</Text>
          <Text style={s.title}>Eleganza da indossare.</Text>
          <Text style={s.subtitle}>Catalogo di prova con capi e varianti dimostrative.</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Cerca reggiseni, body, slip..." placeholderTextColor="#8B8B82" style={s.search} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
            {DEMO_CATEGORIES.map(item => (
              <Pressable key={item} onPress={() => setCategory(item)} style={[s.categoryChip, category === item && s.categoryActive]}>
                <Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.productGrid}>
            {filtered.map(product => (
              <Pressable key={product.id} style={s.productCard} onPress={() => openProduct(product)}>
                <Image source={product.image} style={s.productImage} resizeMode="cover" />
                <View style={s.productInfo}>
                  <Text style={s.productCategory}>{product.category.toUpperCase()}</Text>
                  <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={s.price}>{money(product.price)}</Text>
                  <Text style={s.sampleLabel}>ARTICOLO DEMO</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {!filtered.length && <Text style={s.empty}>Nessun prodotto trovato. Prova un'altra ricerca.</Text>}
          <Text style={s.footerNote}>Le fotografie sono rappresentative. Modelli, prezzi, taglie, colori e disponibilità sono dati fittizi per provare l’app.</Text>
        </ScrollView>
      ) : null}

      {screen === 'cart' ? (
        <ScrollView contentContainerStyle={s.page}>
          <Pressable onPress={() => setScreen('catalog')}><Text style={s.back}>← Continua gli acquisti</Text></Pressable>
          <Text style={s.title}>Il tuo carrello</Text>
          {cartDetails.length ? cartDetails.map(line => (
            <View key={line.key} style={s.cartLine}>
              <Image source={line.product.image} style={s.cartImage} />
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{line.product.name}</Text>
                <Text style={s.muted}>Taglia: {line.size} · Colore: {line.color}</Text>
                <Text style={s.price}>{money(line.product.price)}</Text>
                <View style={s.qtyRow}>
                  <Pressable style={s.qtyButton} onPress={() => changeQty(line.key, -1)}><Text style={s.qtyButtonText}>−</Text></Pressable>
                  <Text style={s.qtyNumber}>{line.qty}</Text>
                  <Pressable style={s.qtyButton} onPress={() => changeQty(line.key, 1)}><Text style={s.qtyButtonText}>+</Text></Pressable>
                </View>
              </View>
            </View>
          )) : <Text style={s.empty}>Il carrello è vuoto. Scegli un capo dimostrativo dal catalogo.</Text>}
          <View style={s.totalBox}>
            <Row label="Subtotale" value={money(subtotal)} />
            <Row label="Spedizione demo" value={shipping === 0 ? 'GRATUITA' : money(shipping)} />
            <View style={s.totalDivider} />
            <Row label="Totale" value={money(total)} strong />
          </View>
          <ActionButton title="PROCEDI AL CHECKOUT DEMO" onPress={() => setScreen('checkout')} disabled={!cartDetails.length} />
          <Text style={s.footerNote}>La simulazione non invia merci e non preleva denaro.</Text>
        </ScrollView>
      ) : null}

      {screen === 'checkout' ? (
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setScreen('cart')}><Text style={s.back}>← Torna al carrello</Text></Pressable>
          <Text style={s.title}>Checkout dimostrativo</Text>
          <Text style={s.subtitle}>Inserisci dati di prova. Non usare informazioni di pagamento reali.</Text>
          <Text style={s.sectionTitle}>DATI DI CONSEGNA</Text>
          <Field label="Nome e cognome" value={customerName} onChangeText={setCustomerName} placeholder="Nome cliente demo" />
          <Field label="Email (facoltativa)" value={email} onChangeText={setEmail} placeholder="cliente@example.com" keyboard="email-address" />
          <Field label="Indirizzo" value={address} onChangeText={setAddress} placeholder="Via di prova, 10" />
          <View style={s.twoFields}>
            <View style={{ flex: 1 }}><Field label="Città" value={city} onChangeText={setCity} placeholder="Città" /></View>
            <View style={{ width: 105 }}><Field label="CAP" value={postalCode} onChangeText={setPostalCode} placeholder="00000" keyboard="numeric" /></View>
          </View>
          <Text style={s.sectionTitle}>SCEGLI UN METODO DI PAGAMENTO DI PROVA</Text>
          {DEMO_PAYMENT_GROUPS.map(group => (
            <View key={group.title}>
              <Text style={s.sectionTitle}>{group.title}</Text>
              {group.methods.map(method => (
                <Pressable key={method.id} onPress={() => setPayment(method.label)} style={[s.paymentOption, payment === method.label && s.paymentSelected]}>
                  <View style={[s.radio, payment === method.label && s.radioActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.paymentText, payment === method.label && s.paymentTextActive]}>{method.label}</Text>
                    <Text style={s.paymentHint}>{method.hint}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={s.providerNotice}>
            <Text style={s.providerNoticeTitle}>FUTURA ATTIVAZIONE ONLINE</Text>
            <Text style={s.providerNoticeText}>Gateway candidato: {PAYMENT_PRODUCTION_PLAN.primaryProvider}. {PAYMENT_PRODUCTION_PLAN.reason}</Text>
            <Text style={s.providerNoticeText}>Alternative predisposte: {PAYMENT_PRODUCTION_PLAN.alternativeProviders.join(' · ')}.</Text>
          </View>
          <View style={s.totalBox}>
            <Row label="Totale ordine" value={money(total)} strong />
            <Text style={s.noCharge}>⚠ SIMULAZIONE: nessun pagamento verrà richiesto o eseguito.</Text>
          </View>
          <ActionButton title={saving ? 'SALVATAGGIO...' : 'CONFERMA ORDINE DI PROVA'} onPress={confirmDemoOrder} disabled={saving} />
        </ScrollView>
      ) : null}

      {screen === 'success' && lastOrder ? (
        <ScrollView contentContainerStyle={[s.page, { alignItems: 'center' }]}>
          <Text style={s.successIcon}>✓</Text>
          <Text style={s.title}>Ordine demo registrato!</Text>
          <Text style={s.subtitle}>La prova del flusso d’acquisto è riuscita.</Text>
          <View style={[s.totalBox, { width: '100%' }]}>
            <Row label="Numero ordine" value={lastOrder.number} />
            <Row label="Totale simulato" value={money(lastOrder.total)} strong />
            <Row label="Pagamento scelto" value={lastOrder.paymentMethod} />
            <Text style={s.noCharge}>NESSUN ADDEBITO · NESSUNA MERCE SPEDITA</Text>
          </View>
          <ActionButton title="TORNA AL CATALOGO" onPress={() => setScreen('catalog')} />
          <Text style={s.footerNote}>L’ordine è stato salvato localmente e puoi trovarlo nel gestionale, alla voce “Ordini demo”.</Text>
        </ScrollView>
      ) : null}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalShade}>
          <View style={s.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected ? <>
                <Image source={selected.image} style={s.modalImage} resizeMode="cover" />
                <Pressable style={s.modalClose} onPress={() => setSelected(null)}><Text style={s.modalCloseText}>✕</Text></Pressable>
                <Text style={s.productCategory}>{selected.category.toUpperCase()} · {selected.id}</Text>
                <Text style={s.modalTitle}>{selected.name}</Text>
                <Text style={s.priceLarge}>{money(selected.price)}</Text>
                <Text style={s.description}>{selected.description}</Text>
                <Text style={s.muted}>Materiale: {selected.material}</Text>
                <Text style={s.variantLabel}>COLORE</Text>
                <View style={s.variantRow}>
                  {selected.colors.map(color => (
                    <Pressable key={color.name} onPress={() => setSelectedColor(color.name)} style={[s.colorOption, selectedColor === color.name && s.variantActive]}>
                      <View style={[s.colorDot, { backgroundColor: color.hex }]} />
                      <Text style={s.variantText}>{color.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.variantLabel}>TAGLIA</Text>
                <View style={s.variantRow}>
                  {selected.sizes.map(size => (
                    <Pressable key={size} onPress={() => setSelectedSize(size)} style={[s.sizeOption, selectedSize === size && s.sizeActive]}>
                      <Text style={[s.sizeText, selectedSize === size && s.sizeTextActive]}>{size}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.demoSmall}>Disponibilità simulata: {selected.stock} pezzi. Non è stock reale.</Text>
                <ActionButton title="AGGIUNGI AL CARRELLO" onPress={addToCart} />
              </> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, strong }) {
  return <View style={s.rowLine}><Text style={[s.rowLabel, strong && s.strong]}>{label}</Text><Text style={[s.rowValue, strong && s.strong]}>{value}</Text></View>;
}
function Field({ label, value, onChangeText, placeholder, keyboard }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8B8B82" keyboardType={keyboard || 'default'} autoCapitalize="none" style={s.input} /></View>;
}
function ActionButton({ title, onPress, disabled }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[s.actionButton, disabled && { opacity: 0.45 }]}><Text style={s.actionText}>{title}</Text></Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: { backgroundColor: DARK, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 52, height: 52, borderRadius: 8, marginRight: 11 },
  brand: { color: '#F8F1E4', fontSize: 20, fontWeight: '800', letterSpacing: 0.4 },
  brandSub: { color: GOLD, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  cartButton: { minWidth: 48, height: 44, borderWidth: 1, borderColor: GOLD, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  cartIcon: { fontSize: 18 }, cartCount: { color: '#FFFFFF', fontWeight: '800' },
  demoBanner: { backgroundColor: '#5A3A27', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginTop: 9 },
  demoBannerText: { color: '#FFF5E5', fontSize: 9, fontWeight: '800', textAlign: 'center', letterSpacing: 0.55 },
  page: { padding: 16, paddingBottom: 34 },
  eyebrow: { color: '#97794B', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  title: { color: DARK, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#696960', fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 12 },
  search: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DCCB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: DARK, marginTop: 8 },
  categoryRow: { gap: 8, paddingVertical: 13 },
  categoryChip: { borderWidth: 1, borderColor: '#CFC5B3', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: '#FFFFFF' },
  categoryActive: { backgroundColor: C, borderColor: C },
  categoryText: { color: '#55564F', fontSize: 12, fontWeight: '600' }, categoryTextActive: { color: '#FFFFFF' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 13 },
  productCard: { width: '48.3%', backgroundColor: '#FFFFFF', borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: '#E9E1D3' },
  productImage: { width: '100%', height: 160, backgroundColor: '#E8E1D7' },
  productInfo: { padding: 10 }, productCategory: { color: '#9A7844', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  productName: { color: DARK, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 4, minHeight: 35 },
  price: { color: C, fontWeight: '800', fontSize: 16, marginTop: 5 },
  sampleLabel: { color: '#9A5344', fontSize: 9, fontWeight: '800', marginTop: 5 },
  empty: { color: '#77766F', textAlign: 'center', paddingVertical: 28, lineHeight: 20 },
  footerNote: { color: '#77766F', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 20 },
  back: { color: C, fontWeight: '700', fontSize: 13, marginBottom: 14 },
  cartLine: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', padding: 11, borderRadius: 12, marginTop: 10 },
  cartImage: { width: 86, height: 100, borderRadius: 8, backgroundColor: '#EEE7DC' },
  muted: { color: '#77766F', fontSize: 11, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  qtyButton: { width: 29, height: 29, borderRadius: 8, backgroundColor: C, alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 }, qtyNumber: { color: DARK, fontWeight: '800' },
  totalBox: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 14, marginTop: 17, borderWidth: 1, borderColor: '#E7DFD2' },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  rowLabel: { color: '#64645C', fontSize: 12, flex: 1 }, rowValue: { color: DARK, fontSize: 12, fontWeight: '700', maxWidth: '62%', textAlign: 'right' },
  strong: { color: DARK, fontSize: 15, fontWeight: '900' }, totalDivider: { height: 1, backgroundColor: '#E8E0D4', marginVertical: 7 },
  actionButton: { backgroundColor: C, borderRadius: 11, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', marginTop: 17 },
  actionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.7 },
  sectionTitle: { color: '#96794C', fontWeight: '900', fontSize: 11, letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
  field: { marginTop: 8 }, fieldLabel: { color: '#5A5B54', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD4C5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: DARK, fontSize: 14 },
  twoFields: { flexDirection: 'row', gap: 10 },
  paymentOption: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3DBCE', borderRadius: 10, padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentSelected: { borderColor: GOLD, backgroundColor: '#FBF6EC' }, paymentHint: { color: '#858278', fontSize: 9, lineHeight: 13, marginTop: 3 }, providerNotice: { backgroundColor: '#EEE8DB', borderRadius: 11, padding: 12, marginTop: 14 }, providerNoticeTitle: { color: '#8A6D3F', fontWeight: '900', fontSize: 10, letterSpacing: 1 }, providerNoticeText: { color: '#5E5E56', fontSize: 10, lineHeight: 15, marginTop: 5 }, radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#9C9A8F' },
  radioActive: { borderWidth: 5, borderColor: C }, paymentText: { color: '#55564F', fontSize: 12, flex: 1 }, paymentTextActive: { color: DARK, fontWeight: '800' },
  noCharge: { color: '#A14C36', fontWeight: '900', fontSize: 10, lineHeight: 15, marginTop: 10 },
  successIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: C, color: '#FFFFFF', textAlign: 'center', textAlignVertical: 'center', fontSize: 38, marginTop: 28, overflow: 'hidden' },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: CREAM, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', padding: 16 },
  modalImage: { width: '100%', height: 230, borderRadius: 14, backgroundColor: '#E7DFD3' },
  modalClose: { position: 'absolute', right: 10, top: 10, backgroundColor: '#FFFFFF', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: DARK, fontSize: 17, fontWeight: '900' }, modalTitle: { color: DARK, fontSize: 22, fontWeight: '900', marginTop: 7 },
  priceLarge: { color: C, fontSize: 21, fontWeight: '900', marginTop: 4 }, description: { color: '#5E5E56', fontSize: 13, lineHeight: 19, marginTop: 9 },
  variantLabel: { color: '#927447', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D8D0C3', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FFFFFF', gap: 6 },
  variantActive: { borderColor: GOLD, borderWidth: 2 }, colorDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: '#999' }, variantText: { color: DARK, fontSize: 11 },
  sizeOption: { minWidth: 42, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D8D0C3', borderRadius: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  sizeActive: { backgroundColor: C, borderColor: C }, sizeText: { color: DARK, fontWeight: '700' }, sizeTextActive: { color: '#FFFFFF' },
  demoSmall: { color: '#9A5344', fontSize: 10, marginTop: 14, fontWeight: '700' }
});
