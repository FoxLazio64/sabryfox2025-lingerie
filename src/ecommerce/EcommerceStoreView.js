import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { CATEGORIES } from '../catalog';
import { BRAND } from '../config';
import {
  fetchMyCustomerOrders,
  fetchShopCatalog,
  placeCustomerOrder,
} from './ShopService';

const C = {
  bg: '#21121B',
  card: '#3D1B2D',
  cardSoft: '#2E1523',
  gold: '#C9A66B',
  goldLight: '#E7D4AC',
  cream: '#FBF6F2',
  white: '#FFFDFC',
  muted: '#D5C1C6',
  subtle: '#9C838B',
  border: '#6A3A50',
  danger: '#B8545A',
  success: '#4F8A6B',
};

function formatPrice(price) {
  if (price === null || price === undefined || Number.isNaN(Number(price))) {
    return 'Su richiesta';
  }
  return Number(price).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

export default function EcommerceStoreView({
  session = null,
  isVip = false,
  onOpenBackoffice = null,
  onRequestLogin = null,
}) {
  const isAuthenticated = Boolean(session?.uid || session?.email || session?.role);

  const [tab, setTab] = useState('catalogo');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Tutti');
  const [selectedSizes, setSelectedSizes] = useState({});
  const [previewItem, setPreviewItem] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});
  const [cart, setCart] = useState([]);

  const [customerName, setCustomerName] = useState(session?.name || session?.username || '');
  const [customerEmail, setCustomerEmail] = useState(session?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (session?.name || session?.username) {
      setCustomerName((prev) => prev || session.name || session.username || '');
    }
    if (session?.email) {
      setCustomerEmail((prev) => prev || session.email || '');
    }
  }, [session]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchShopCatalog({ includeVip: isVip });
      setProducts(list);
    } finally {
      setLoading(false);
    }
  }, [isVip]);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const list = await fetchMyCustomerOrders();
      setOrders(list);
    } finally {
      setLoadingOrders(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tab === 'ordini') {
      loadOrders();
    }
  }, [tab, loadOrders]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Tutti') return products;
    return products.filter(
      (p) => String(p.category || '').toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const cartTotal = useMemo(() => {
    if (cart.some((i) => i.price === null || i.price === undefined)) return null;
    return cart.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  }, [cart]);

  const addToCart = (product) => {
    const chosenSize =
      selectedSizes[product.id] ||
      (Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes[0] : '');
    const key = `${product.id}::${chosenSize}`;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          code: product.code,
          name: product.name,
          price: product.price,
          size: chosenSize,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrello vuoto', 'Aggiungi almeno un capo prima di inviare l’ordine.');
      return;
    }

    if (!isAuthenticated) {
      if (typeof onRequestLogin === 'function') {
        onRequestLogin('checkout');
      } else {
        Alert.alert('Accesso richiesto', 'Effettua il login per completare l’acquisto.');
      }
      return;
    }

    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !customerAddress.trim() ||
      !customerCity.trim() ||
      !customerPostalCode.trim()
    ) {
      Alert.alert('Dati mancanti', 'Compila nome, telefono, indirizzo, città e CAP per la consegna.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await placeCustomerOrder({
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress,
          city: customerCity,
          postalCode: customerPostalCode,
        },
        items: cart,
        note: orderNote,
      });
      setCart([]);
      setOrderNote('');
      Alert.alert(
        'Ordine inviato',
        `Il tuo ordine ${created.id} è stato registrato con successo.`
      );
      setTab('ordini');
    } catch (error) {
      Alert.alert('Errore invio ordine', error?.message || 'Impossibile inviare l’ordine.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.container}>
        <Image source={require('../../assets/logo.jpg')} style={s.logo} resizeMode="contain" />
        <Text style={s.brandTitle}>{BRAND.name.toUpperCase()}</Text>
        <Text style={s.brandSub}>
          {isVip ? 'BOUTIQUE E-COMMERCE · AREA VIP' : 'BOUTIQUE E-COMMERCE'}
        </Text>
        <Text style={s.welcome}>
          {isAuthenticated
            ? `Benvenuta/o, ${session?.name || session?.username || 'Cliente'}`
            : 'Esplora liberamente il catalogo · Accesso richiesto solo per l’acquisto'}
        </Text>

        {onOpenBackoffice ? (
          <Pressable style={s.backofficeBtn} onPress={onOpenBackoffice}>
            <Text style={s.backofficeBtnText}>Torna al Gestionale Aziendale</Text>
          </Pressable>
        ) : null}

        <View style={s.navRow}>
          <Pressable
            style={[s.navBtn, tab === 'catalogo' && s.navBtnActive]}
            onPress={() => setTab('catalogo')}
          >
            <Text style={[s.navText, tab === 'catalogo' && s.navTextActive]}>Catalogo</Text>
          </Pressable>
          <Pressable
            style={[s.navBtn, tab === 'carrello' && s.navBtnActive]}
            onPress={() => setTab('carrello')}
          >
            <Text style={[s.navText, tab === 'carrello' && s.navTextActive]}>
              Carrello ({cartCount})
            </Text>
          </Pressable>
          <Pressable
            style={[s.navBtn, tab === 'ordini' && s.navBtnActive]}
            onPress={() => setTab('ordini')}
          >
            <Text style={[s.navText, tab === 'ordini' && s.navTextActive]}>I miei ordini</Text>
          </Pressable>
        </View>

        {tab === 'catalogo' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[s.catChip, active && s.catChipActive]}
                  >
                    <Text style={[s.catChipText, active && s.catChipTextActive]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {loading ? (
              <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 28 }} />
            ) : filteredProducts.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Nessun capo disponibile in questa categoria</Text>
                <Text style={s.emptyCopy}>
                  Controlla un’altra categoria oppure riprova più tardi.
                </Text>
              </View>
            ) : (
              filteredProducts.map((item) => {
                const activeSize =
                  selectedSizes[item.id] ||
                  (Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes[0] : '');

                return (
                  <View key={item.id} style={s.card}>
                    <Pressable
                      onPress={() => setPreviewItem(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Ingrandisci foto di ${item.name}`}
                    >
                      <Image
                        source={
                          item.imageUrl && !brokenImages[item.id]
                            ? { uri: item.imageUrl }
                            : require('../../assets/logo.jpg')
                        }
                        style={s.productImg}
                        resizeMode={item.imageUrl && !brokenImages[item.id] ? 'cover' : 'contain'}
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                      />
                    </Pressable>
                    <View style={s.cardHeader}>
                      <Text style={s.cardCategory}>{item.category}</Text>
                      {item.sourceCatalog === 'vip' ? (
                        <Text style={s.vipBadge}>VIP</Text>
                      ) : null}
                    </View>
                    <Text style={s.cardTitle}>{item.name}</Text>
                    <Text style={s.cardPrice}>{formatPrice(item.price)}</Text>
                    {item.description ? (
                      <Text style={s.cardDesc}>{item.description}</Text>
                    ) : null}
                    {item.color ? (
                      <Text style={s.metaText}>Colore: {item.color}</Text>
                    ) : null}

                    {Array.isArray(item.sizes) && item.sizes.length > 0 ? (
                      <View style={s.sizeRow}>
                        {item.sizes.map((sz) => {
                          const selected = activeSize === sz;
                          return (
                            <Pressable
                              key={sz}
                              onPress={() => setSelectedSizes((prev) => ({ ...prev, [item.id]: sz }))}
                              style={[s.sizeChip, selected && s.sizeChipActive]}
                            >
                              <Text style={[s.sizeText, selected && s.sizeTextActive]}>{sz}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    <Pressable style={s.primaryBtn} onPress={() => addToCart(item)}>
                      <Text style={s.primaryBtnText}>Aggiungi al carrello</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'carrello' && (
          <View>
            {cart.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Il tuo carrello è vuoto</Text>
                <Text style={s.emptyCopy}>
                  Scegli i capi dal catalogo per preparare il tuo ordine.
                </Text>
              </View>
            ) : (
              <>
                {cart.map((line) => (
                  <View key={line.key} style={s.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{line.name}</Text>
                      <Text style={s.metaText}>
                        {line.size ? `Taglia: ${line.size} · ` : ''}
                        {formatPrice(line.price)}
                      </Text>
                    </View>
                    <View style={s.qtyBox}>
                      <Pressable style={s.qtyBtn} onPress={() => updateQty(line.key, -1)}>
                        <Text style={s.qtyBtnText}>-</Text>
                      </Pressable>
                      <Text style={s.qtyVal}>{line.qty}</Text>
                      <Pressable style={s.qtyBtn} onPress={() => updateQty(line.key, 1)}>
                        <Text style={s.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                <View style={s.totalBox}>
                  <Text style={s.totalLabel}>Totale stimato</Text>
                  <Text style={s.totalValue}>
                    {cartTotal === null ? 'Da confermare' : formatPrice(cartTotal)}
                  </Text>
                </View>

                {!isAuthenticated ? (
                  <View style={s.formCard}>
                    <Text style={s.sectionTitle}>Completa l'acquisto</Text>
                    <Text style={s.metaText}>
                      Per confermare l’ordine e inserire i dati di consegna è necessario accedere o registrarsi. Il tuo carrello resterà salvato.
                    </Text>
                    <Pressable
                      style={s.primaryBtn}
                      onPress={() => {
                        if (typeof onRequestLogin === 'function') {
                          onRequestLogin('checkout');
                        }
                      }}
                    >
                      <Text style={s.primaryBtnText}>Accedi o registrati per acquistare</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={s.formCard}>
                    <Text style={s.sectionTitle}>Dati di spedizione e contatto</Text>
                    <TextInput
                      style={s.input}
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="Nome e Cognome *"
                      placeholderTextColor={C.subtle}
                    />
                    <TextInput
                      style={s.input}
                      value={customerEmail}
                      onChangeText={setCustomerEmail}
                      placeholder="Email"
                      placeholderTextColor={C.subtle}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={s.input}
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                      placeholder="Telefono *"
                      placeholderTextColor={C.subtle}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={s.input}
                      value={customerAddress}
                      onChangeText={setCustomerAddress}
                      placeholder="Indirizzo (Via e civico) *"
                      placeholderTextColor={C.subtle}
                    />
                    <TextInput
                      style={s.input}
                      value={customerCity}
                      onChangeText={setCustomerCity}
                      placeholder="Città *"
                      placeholderTextColor={C.subtle}
                    />
                    <TextInput
                      style={s.input}
                      value={customerPostalCode}
                      onChangeText={setCustomerPostalCode}
                      placeholder="CAP *"
                      placeholderTextColor={C.subtle}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[s.input, { minHeight: 72 }]}
                      value={orderNote}
                      onChangeText={setOrderNote}
                      placeholder="Note per l'ordine (facoltativo)"
                      placeholderTextColor={C.subtle}
                      multiline
                    />

                    <Pressable
                      style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
                      onPress={handleCheckout}
                      disabled={submitting}
                    >
                      <Text style={s.primaryBtnText}>
                        {submitting ? 'Invio in corso...' : 'Conferma ordine'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {tab === 'ordini' && (
          <View>
            {!isAuthenticated ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Accesso richiesto per i tuoi ordini</Text>
                <Text style={s.emptyCopy}>
                  Accedi al tuo account per visualizzare lo storico degli acquisti.
                </Text>
                {typeof onRequestLogin === 'function' ? (
                  <Pressable
                    style={[s.primaryBtn, { paddingHorizontal: 20 }]}
                    onPress={() => onRequestLogin('orders')}
                  >
                    <Text style={s.primaryBtnText}>Accedi ora</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : loadingOrders ? (
              <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 28 }} />
            ) : orders.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Nessun ordine effettuato</Text>
                <Text style={s.emptyCopy}>
                  Qui troverai lo storico e lo stato dei tuoi ordini.
                </Text>
              </View>
            ) : (
              orders.map((ord) => (
                <View key={ord.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>{ord.id}</Text>
                    <Text style={s.statusBadge}>{String(ord.status || 'ricevuto').toUpperCase()}</Text>
                  </View>
                  <Text style={s.metaText}>
                    Data: {ord.createdAt ? new Date(ord.createdAt).toLocaleString('it-IT') : '-'}
                  </Text>
                  <Text style={s.cardPrice}>Totale: {formatPrice(ord.total)}</Text>
                  {Array.isArray(ord.items) &&
                    ord.items.map((it, i) => (
                      <Text key={`${ord.id}-${i}`} style={s.metaText}>
                        • {it.qty}x {it.name} {it.size ? `(${it.size})` : ''}
                      </Text>
                    ))}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(previewItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            {previewItem ? (
              <>
                <Text style={s.modalTitle}>{previewItem.name}</Text>
                <Text style={s.modalMeta}>
                  {previewItem.brand ? `${previewItem.brand} · ` : ''}{previewItem.category} · {formatPrice(previewItem.price)}
                </Text>
                <Image
                  source={
                    previewItem.imageUrl && !brokenImages[previewItem.id]
                      ? { uri: previewItem.imageUrl }
                      : require('../../assets/logo.jpg')
                  }
                  style={s.modalImg}
                  resizeMode="contain"
                  onError={() =>
                    setBrokenImages((prev) => ({ ...prev, [previewItem.id]: true }))
                  }
                />
              </>
            ) : null}
            <Pressable style={s.modalCloseBtn} onPress={() => setPreviewItem(null)}>
              <Text style={s.modalCloseText}>Chiudi anteprima</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  container: { padding: 18, paddingBottom: 42 },
  logo: { width: 88, height: 88, alignSelf: 'center', marginBottom: 8 },
  brandTitle: { color: C.goldLight, fontSize: 20, textAlign: 'center', fontFamily: 'Georgia', letterSpacing: 1.5 },
  brandSub: { color: C.gold, fontSize: 11, textAlign: 'center', marginTop: 2, letterSpacing: 1 },
  welcome: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 14 },
  backofficeBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  backofficeBtnText: { color: C.goldLight, fontSize: 12, fontWeight: '700' },
  navRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  navBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardSoft,
    alignItems: 'center',
  },
  navBtnActive: { backgroundColor: C.gold, borderColor: C.gold },
  navText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  navTextActive: { color: C.bg },
  catRow: { marginBottom: 12 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardSoft,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: C.gold, borderColor: C.gold },
  catChipText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  catChipTextActive: { color: C.bg, fontWeight: '700' },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.gold,
  },
  productImg: { width: '100%', height: 190, borderRadius: 10, marginBottom: 10, backgroundColor: C.cardSoft },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.gold,
  },
  modalTitle: { color: C.goldLight, fontSize: 16, fontWeight: '700' },
  modalMeta: { color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },
  modalImg: { width: '100%', height: 340, borderRadius: 10, backgroundColor: C.cardSoft, marginBottom: 14 },
  modalCloseBtn: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalCloseText: { color: C.bg, fontSize: 13, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { color: C.gold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  vipBadge: {
    backgroundColor: C.gold,
    color: C.bg,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadge: {
    backgroundColor: C.cardSoft,
    borderColor: C.gold,
    borderWidth: 1,
    color: C.goldLight,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardTitle: { color: C.white, fontSize: 16, fontWeight: '700', marginTop: 4 },
  cardPrice: { color: C.goldLight, fontSize: 15, fontWeight: '700', marginTop: 4 },
  cardDesc: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  metaText: { color: C.muted, fontSize: 12, marginTop: 4 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardSoft,
  },
  sizeChipActive: { borderColor: C.gold, backgroundColor: C.gold },
  sizeText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  sizeTextActive: { color: C.bg, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: C.bg, fontSize: 13, fontWeight: '800' },
  emptyBox: {
    backgroundColor: C.cardSoft,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: { color: C.goldLight, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  cartRow: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  qtyVal: { color: C.white, fontSize: 14, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  totalBox: {
    backgroundColor: C.cardSoft,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.gold,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: { color: C.muted, fontSize: 14, fontWeight: '600' },
  totalValue: { color: C.goldLight, fontSize: 17, fontWeight: '800' },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.gold,
  },
  sectionTitle: { color: C.goldLight, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  input: {
    backgroundColor: C.cardSoft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.white,
    fontSize: 13,
    marginBottom: 10,
  },
});
