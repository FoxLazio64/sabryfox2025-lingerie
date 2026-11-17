import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL, BRAND, PRIVACY_POLICY_URL } from './src/config';
import { CATEGORIES, LOCAL_CATALOG } from './src/catalog';
import AuthGate from './src/gestionale/AuthGate';
import ManagementDashboard from './src/gestionale/ManagementDashboard';

const C = {
  forest: '#06180F',
  forest2: '#10291C',
  ink: '#21180F',
  gold: '#CDA45F',
  goldLight: '#F2DCA9',
  cream: '#F4EFE5',
  paper: '#FFFCF5',
  muted: '#766A5B',
  line: '#DED1BC',
  bronze: '#80572F',
  green: '#376A48',
  red: '#A23C3C',
};

const KEYS = {
  catalog: '@sabryfox/catalog-v1',
  cart: '@sabryfox/cart-v1',
  favorites: '@sabryfox/favorites-v1',
  orders: '@sabryfox/orders-v1',
  profile: '@sabryfox/profile-v1',
  token: '@sabryfox/token-v1',
  sessionUser: '@sabryfox/user-v1',
};

const ROLE_LABELS = {
  'amministratore-unico': 'Amministratore unico',
  'amministrazione-finanze': 'Amministrazione e Finanze',
  dipendente: 'Dipendente',
  cliente: 'Cliente',
};

function mapLocalSession(session) {
  if (!session) return null;

  const roleMap = {
    'Amministratore unico': 'amministratore-unico',
    'Amministrazione e Finanze': 'amministrazione-finanze',
    'Dipendenti': 'dipendente',
    'Cliente': 'cliente',
  };

  return {
    id: String(session.id || 'local'),
    name: session.name || session.username || 'Cliente',
    username: session.username || '',
    email: session.username || '',
    role: roleMap[session.role] || 'cliente',
  };
}

function money(value) {
  if (value === null || value === undefined || value === '') return 'Prezzo su richiesta';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, autoCapitalize = 'sentences' }) {
  return (
    <View style={styles.fieldWrap}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#958B7D"
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function GoldButton({ title, onPress, secondary = false, disabled = false, compact = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.goldButton,
        secondary && styles.secondaryButton,
        compact && styles.compactButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.goldButtonText, secondary && styles.secondaryButtonText, compact && styles.compactButtonText]}>{title}</Text>
    </Pressable>
  );
}

function ProductArt({ product, large = false }) {
  const symbol = product.symbol || '✦';
  return (
    <View style={[styles.productArt, large && styles.productArtLarge]}>
      <View style={styles.artHalo} />
      <Text style={[styles.productSymbol, large && styles.productSymbolLarge]}>{symbol}</Text>
      <Text style={styles.artBrand}>SABRYFOX2025</Text>
    </View>
  );
}

function ProductCard({ product, favorite, onOpen, onFavorite }) {
  return (
    <View style={styles.productCard}>
      <Pressable onPress={onOpen}>
        <View style={styles.productArtWrap}>
          <ProductArt product={product} />
          <View style={styles.productCategoryTag}><Text style={styles.productCategoryText}>{product.category}</Text></View>
        </View>
        <View style={styles.productCardBody}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productPrice}>{money(product.price)}</Text>
          <Text style={styles.productAvailability}>
            {product.stock === null || product.stock === undefined ? 'Disponibilità da verificare' : Number(product.stock) > 0 ? 'Disponibile' : 'Non disponibile'}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onFavorite} style={styles.favoriteButton} accessibilityLabel="Aggiungi ai preferiti">
        <Text style={[styles.favoriteIcon, favorite && styles.favoriteActive]}>{favorite ? '♥' : '♡'}</Text>
      </Pressable>
    </View>
  );
}

function BoutiqueApp({ authSession }) {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState('home');
  const [catalog, setCatalog] = useState(LOCAL_CATALOG);
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', address: '', city: '', postalCode: '' });
  const [token, setToken] = useState('');
  const [sessionUser, setSessionUser] = useState(() => mapLocalSession(authSession));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tutti');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkout, setCheckout] = useState({ name: '', email: '', phone: '', address: '', city: '', postalCode: '', note: '', privacyAccepted: false });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [serverOrders, setServerOrders] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', category: 'Completi', description: '', price: '', stock: '' });
  const [productEdits, setProductEdits] = useState({});
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'dipendente' });
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const syncing = useRef(false);

  const apiConfigured = Boolean(API_BASE_URL && API_BASE_URL.startsWith('https://'));
  const apiRoot = API_BASE_URL.replace(/\/+$/, '');
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const staff = Boolean(sessionUser && sessionUser.role && sessionUser.role !== 'cliente');
  const owner = Boolean(sessionUser && sessionUser.role === 'amministratore-unico');

  const request = useCallback(async (path, options = {}) => {
    if (!apiConfigured) throw new Error('Il collegamento al negozio online non è ancora configurato.');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const activeToken = options.token !== undefined ? options.token : token;
    if (activeToken) headers.Authorization = `Bearer ${activeToken}`;
    const response = await fetch(`${apiRoot}${path}`, { ...options, headers, token: undefined });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Errore del servizio (${response.status}).`);
    return payload;
  }, [apiConfigured, apiRoot, token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
        const saved = Object.fromEntries(pairs);
        if (!mounted) return;
        const read = (key, fallback) => {
          try { return saved[KEYS[key]] ? JSON.parse(saved[KEYS[key]]) : fallback; } catch { return fallback; }
        };
        setCatalog(read('catalog', LOCAL_CATALOG));
        setCart(read('cart', []));
        setFavorites(read('favorites', []));
        setOrders(read('orders', []));
        setProfile(read('profile', { name: '', email: '', phone: '', address: '', city: '', postalCode: '' }));
        // Credenziali e sessione sono gestite da AuthGate in locale.
      } catch (error) {
        console.warn('Lettura archivio locale non riuscita:', error?.message);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    NetInfo.fetch().then(state => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))).catch(() => {});
    return () => { mounted = false; unsubscribe(); };
  }, []);

  // Aggiorna la boutique ogni volta che AuthGate cambia sessione.
  useEffect(() => {
    setSessionUser(mapLocalSession(authSession));
  }, [authSession]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.multiSet([
      [KEYS.catalog, JSON.stringify(catalog)],
      [KEYS.cart, JSON.stringify(cart)],
      [KEYS.favorites, JSON.stringify(favorites)],
      [KEYS.orders, JSON.stringify(orders)],
      [KEYS.profile, JSON.stringify(profile)],
      // Token e sessione non vengono archiviati dalla boutique.
    ]).catch(error => console.warn('Salvataggio locale non riuscito:', error?.message));
  }, [ready, catalog, cart, favorites, orders, profile, token, sessionUser]);

  const refreshCatalog = useCallback(async () => {
    if (!online || !apiConfigured) return;
    try {
      const result = await request('/api/catalog', { method: 'GET' });
      if (Array.isArray(result.products)) {
        setCatalog(result.products);
        setLastSync(new Date().toISOString());
      }
    } catch (error) {
      console.warn('Catalogo online non aggiornato:', error?.message);
    }
  }, [online, apiConfigured, request]);

  const syncPendingOrders = useCallback(async () => {
    if (!ready || !online || !apiConfigured || syncing.current) return;
    const pending = orders.filter(order => !order.synced);
    if (!pending.length) return;
    syncing.current = true;
    try {
      for (const order of pending) {
        try {
          const payload = await request('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
              clientOrderId: order.id,
              customer: order.customer,
              items: order.items.map(item => ({ productId: item.productId, qty: item.quantity, size: item.size })),
              note: order.note || '',
              source: 'offline',
            }),
            token,
          });
          setOrders(current => current.map(item => item.id === order.id ? { ...item, synced: true, serverId: payload.order?.id || null, status: payload.order?.status || 'ricevuto' } : item));
        } catch (error) {
          console.warn('Ordine ancora in coda:', error?.message);
          break;
        }
      }
      setLastSync(new Date().toISOString());
    } finally {
      syncing.current = false;
    }
  }, [ready, online, apiConfigured, orders, request, token]);

  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);
  useEffect(() => { syncPendingOrders(); }, [syncPendingOrders]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(product => product.active !== false)
      .filter(product => category === 'Tutti' || product.category === category)
      .filter(product => !q || `${product.name} ${product.category} ${product.description || ''}`.toLowerCase().includes(q));
  }, [catalog, category, search]);

  const favoriteProducts = useMemo(() => catalog.filter(product => favorites.includes(product.id)), [catalog, favorites]);
  const cartTotal = cart.reduce((sum, item) => {
    const p = catalog.find(product => product.id === item.productId);
    if (!p || p.price === null || p.price === undefined) return sum;
    return sum + Number(p.price) * Number(item.quantity || 0);
  }, 0);
  const cartHasUnpriced = cart.some(item => {
    const p = catalog.find(product => product.id === item.productId);
    return !p || p.price === null || p.price === undefined;
  });

  const toggleFavorite = id => setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const openProduct = product => {
    setSelectedProduct(product);
    setSelectedSize(safeArray(product.sizes)[0] || 'Taglia da concordare');
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart(current => {
      const existing = current.find(item => item.productId === selectedProduct.id && item.size === selectedSize);
      if (existing) return current.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId: selectedProduct.id, size: selectedSize, quantity: 1 }];
    });
    setSelectedProduct(null);
    Alert.alert('Aggiunto al carrello', 'Il prodotto è stato salvato anche sul dispositivo.');
  };

  const changeCartQuantity = (productId, size, delta) => {
    setCart(current => current.map(item => item.productId === productId && item.size === size ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0));
  };

  const openCheckout = () => {
    setCheckout({
      name: profile.name || sessionUser?.name || '',
      email: profile.email || sessionUser?.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      city: profile.city || '',
      postalCode: profile.postalCode || '',
      note: '',
      privacyAccepted: false,
    });
    setCheckoutOpen(true);
  };

  const completeCheckout = async () => {
    const required = ['name', 'email', 'phone', 'address', 'city', 'postalCode'];
    const missing = required.filter(key => !String(checkout[key] || '').trim());
    if (missing.length) {
      Alert.alert('Dati mancanti', 'Compila nome, e-mail, telefono e indirizzo di consegna.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(checkout.email.trim())) {
      Alert.alert('E-mail non valida', 'Controlla l’indirizzo e-mail inserito.');
      return;
    }
    if (!checkout.privacyAccepted) {
      Alert.alert('Consenso richiesto', 'Per inviare la richiesta devi confermare di aver letto l’informativa privacy.');
      return;
    }
    if (!cart.length) return;
    setBusy(true);
    const customer = {
      name: checkout.name.trim(), email: checkout.email.trim().toLowerCase(), phone: checkout.phone.trim(),
      address: checkout.address.trim(), city: checkout.city.trim(), postalCode: checkout.postalCode.trim(),
    };
    const localOrder = {
      id: `SF-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customer,
      items: cart.map(item => {
        const p = catalog.find(product => product.id === item.productId);
        return { productId: item.productId, name: p?.name || item.productId, quantity: item.quantity, size: item.size, unitPrice: p?.price ?? null };
      }),
      note: checkout.note.trim(),
      total: cartHasUnpriced ? null : cartTotal,
      status: 'in_coda',
      synced: false,
    };
    try {
      setProfile(current => ({ ...current, ...customer }));
      let finalOrder = localOrder;
      if (online && apiConfigured) {
        try {
          const result = await request('/api/orders', {
            method: 'POST',
            token,
            body: JSON.stringify({
              clientOrderId: localOrder.id,
              customer,
              items: localOrder.items.map(item => ({ productId: item.productId, qty: item.quantity, size: item.size })),
              note: localOrder.note,
              source: 'online',
            }),
          });
          finalOrder = { ...localOrder, synced: true, serverId: result.order?.id || null, status: result.order?.status || 'ricevuto' };
        } catch (error) {
          console.warn('Invio immediato fallito; richiesta mantenuta sul dispositivo:', error?.message);
        }
      }
      setOrders(current => [finalOrder, ...current]);
      if (finalOrder.synced && token) {
        try {
          const mine = await request('/api/my-orders', { method: 'GET', token });
          setCustomerOrders(safeArray(mine.orders));
        } catch {}
      }
      setCart([]);
      setCheckoutOpen(false);
      setTab('account');
      Alert.alert(
        finalOrder.synced ? 'Richiesta inviata' : 'Richiesta salvata sul dispositivo',
        finalOrder.synced
          ? 'La richiesta è stata trasmessa al negozio.'
          : 'La richiesta è conservata sul dispositivo e sarà inviata quando il servizio online sarà configurato e raggiungibile.',
      );
    } finally {
      setBusy(false);
    }
  };

  const authenticate = async () => {
    if (!apiConfigured || !online) {
      Alert.alert('Accesso online non disponibile', 'Per creare un account o accedere serve il collegamento al negozio online. Il catalogo e il carrello restano utilizzabili offline.');
      return;
    }
    if (!authForm.email.trim() || !authForm.password) {
      Alert.alert('Dati mancanti', 'Inserisci e-mail e password.');
      return;
    }
    if (authMode === 'register' && !authForm.name.trim()) {
      Alert.alert('Nome mancante', 'Inserisci il tuo nome.');
      return;
    }
    setBusy(true);
    try {
      const result = await request(authMode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ name: authForm.name.trim(), email: authForm.email.trim(), password: authForm.password }),
        token: '',
      });
      setToken(result.token || '');
      setSessionUser(result.user || null);
      setAuthForm({ name: '', email: '', password: '' });
      Alert.alert('Accesso effettuato', `Benvenuto${result.user?.name ? `, ${result.user.name}` : ''}.`);
      if (result.user?.role && result.user.role !== 'cliente') loadStaffOrders(result.token || '');
      else {
        try {
          const mine = await request('/api/my-orders', { method: 'GET', token: result.token || '' });
          setCustomerOrders(safeArray(mine.orders));
        } catch {}
      }
    } catch (error) {
      Alert.alert('Accesso non riuscito', error.message);
    } finally {
      setBusy(false);
    }
  };

  const loadStaffOrders = async explicitToken => {
    if (!apiConfigured || !online || !(explicitToken || token)) return;
    try {
      const result = await request('/api/admin/orders', { method: 'GET', token: explicitToken || token });
      setServerOrders(safeArray(result.orders));
    } catch (error) {
      Alert.alert('Area gestione', error.message);
    }
  };

  const setOrderStatus = async (orderId, status) => {
    try {
      await request(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      await loadStaffOrders();
    } catch (error) {
      Alert.alert('Aggiornamento non riuscito', error.message);
    }
  };

  const createProduct = async () => {
    if (!productForm.name.trim() || !productForm.description.trim() || productForm.price.trim() === '') {
      Alert.alert('Scheda incompleta', 'Inserisci nome, descrizione e prezzo prima di pubblicare il prodotto.');
      return;
    }
    const price = Number(productForm.price.replace(',', '.'));
    const stock = productForm.stock.trim() === '' ? null : Number(productForm.stock);
    if (!Number.isFinite(price) || price <= 0 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
      Alert.alert('Valori non validi', 'Il prezzo deve essere maggiore di zero e la giacenza un numero intero non negativo.');
      return;
    }
    try {
      await request('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({ name: productForm.name.trim(), category: productForm.category, description: productForm.description.trim(), price, stock, active: true, sizes: ['S', 'M', 'L'] }),
      });
      setProductForm({ name: '', category: 'Completi', description: '', price: '', stock: '' });
      await refreshCatalog();
      Alert.alert('Prodotto pubblicato', 'La scheda è stata inserita nel catalogo online.');
    } catch (error) {
      Alert.alert('Pubblicazione non riuscita', error.message);
    }
  };

  const saveProductEdit = async product => {
    const edit = productEdits[product.id] || { price: product.price === null || product.price === undefined ? '' : String(product.price), stock: product.stock === null || product.stock === undefined ? '' : String(product.stock) };
    const body = {};
    if (String(edit.price).trim() !== '') {
      const price = Number(String(edit.price).replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) {
        Alert.alert('Prezzo non valido', 'Inserisci un prezzo maggiore di zero.');
        return;
      }
      body.price = price;
    }
    if (String(edit.stock).trim() !== '') {
      const stock = Number(edit.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        Alert.alert('Giacenza non valida', 'Inserisci una quantità intera non negativa.');
        return;
      }
      body.stock = stock;
    }
    if (!Object.keys(body).length) {
      Alert.alert('Nessuna modifica', 'Inserisci almeno un prezzo o una giacenza.');
      return;
    }
    try {
      await request(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      setProductEdits(current => { const next = { ...current }; delete next[product.id]; return next; });
      await refreshCatalog();
      Alert.alert('Scheda aggiornata', `${product.name}: modifica salvata nel catalogo online.`);
    } catch (error) {
      Alert.alert('Aggiornamento non riuscito', error.message);
    }
  };

  const createStaffAccount = async () => {
    if (!staffForm.name.trim() || !staffForm.email.trim() || staffForm.password.length < 10) {
      Alert.alert('Dati incompleti', 'Inserisci nome, e-mail e una password di almeno 10 caratteri.');
      return;
    }
    try {
      await request('/api/admin/staff', { method: 'POST', body: JSON.stringify(staffForm) });
      setStaffForm({ name: '', email: '', password: '', role: 'dipendente' });
      Alert.alert('Account creato', 'Il nuovo account è stato creato con il ruolo selezionato.');
    } catch (error) {
      Alert.alert('Creazione non riuscita', error.message);
    }
  };

  const logout = () => {
    setToken('');
    setSessionUser(null);
    setServerOrders([]);
    setTab('account');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Image source={require('./assets/logo.jpg')} style={styles.headerLogo} resizeMode="cover" />
        <View>
          <Text style={styles.headerTitle}>{BRAND.name}</Text>
          <Text style={styles.headerSubtitle}>{BRAND.subtitle}</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <View style={[styles.connectionDot, online && styles.connectionDotOn]} />
        <Text style={styles.connectionText}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
        <Pressable onPress={() => setTab('cart')} style={styles.headerCart}>
          <Text style={styles.headerCartIcon}>🛍</Text>
          {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
        </Pressable>
      </View>
    </View>
  );

  const renderHero = () => (
    <View style={styles.hero}>
      <View style={styles.heroTopLine} />
      <Text style={styles.heroEyebrow}>ELEGANZA · IDENTITÀ · FEMMINILITÀ</Text>
      <Text style={styles.heroTitle}>Il piacere di sentirsi unica.</Text>
      <Text style={styles.heroCopy}>Scopri le collezioni SabryFox2025 Lingerie e crea il tuo stile, con o senza connessione.</Text>
      <GoldButton title="SCOPRI LA COLLEZIONE" onPress={() => { setTab('catalog'); setCategory('Tutti'); }} compact />
      <View style={styles.heroSeal}><Text style={styles.heroSealText}>SF</Text></View>
    </View>
  );

  const renderCategoryChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {CATEGORIES.map(item => (
        <Pressable key={item} onPress={() => { setCategory(item); setTab('catalog'); }} style={[styles.categoryChip, category === item && styles.categoryChipActive]}>
          <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderProductGrid = products => {
    if (!products.length) return <Text style={styles.emptyText}>Nessun prodotto trovato in questa selezione.</Text>;
    return (
      <View style={styles.productGrid}>
        {products.map(product => (
          <View key={product.id} style={styles.productGridItem}>
            <ProductCard
              product={product}
              favorite={favorites.includes(product.id)}
              onOpen={() => openProduct(product)}
              onFavorite={() => toggleFavorite(product.id)}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {renderHero()}
      <View style={styles.sectionHeadingRow}>
        <View><Text style={styles.eyebrow}>IL MONDO SABRYFOX</Text><Text style={styles.sectionTitle}>Esplora le collezioni</Text></View>
        <Pressable onPress={() => setTab('catalog')}><Text style={styles.textLink}>Vedi tutto →</Text></Pressable>
      </View>
      {renderCategoryChips()}
      <View style={styles.sectionHeadingRow}>
        <View><Text style={styles.eyebrow}>SELEZIONE</Text><Text style={styles.sectionTitle}>In evidenza</Text></View>
      </View>
      {renderProductGrid(catalog.filter(p => p.active !== false).slice(0, 4))}
      <View style={styles.serviceStrip}>
        <View style={styles.serviceItem}><Text style={styles.serviceIcon}>◇</Text><Text style={styles.serviceTitle}>Catalogo locale</Text><Text style={styles.serviceCopy}>Le schede salvate restano consultabili offline.</Text></View>
        <View style={styles.serviceItem}><Text style={styles.serviceIcon}>↻</Text><Text style={styles.serviceTitle}>Ordini in coda</Text><Text style={styles.serviceCopy}>Le richieste offline si sincronizzano al ritorno della rete.</Text></View>
      </View>
      <Text style={styles.disclaimer}>Le schede iniziali riportano soltanto i nomi e le categorie già definiti. Prezzi, foto, taglie, varianti e disponibilità saranno inseriti dal negozio prima della vendita.</Text>
    </ScrollView>
  );

  const renderCatalog = () => (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>SHOP SABRYFOX2025</Text>
      <Text style={styles.pageTitle}>Il catalogo</Text>
      <Text style={styles.pageIntro}>Una selezione da consultare anche senza connessione. Il catalogo online aggiornerà prezzi e disponibilità quando il servizio sarà collegato.</Text>
      <Field label="Cerca nel catalogo" value={search} onChangeText={setSearch} placeholder="Nome o categoria" />
      {renderCategoryChips()}
      {renderProductGrid(visibleProducts)}
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <Text style={styles.eyebrow}>LA TUA SELEZIONE</Text>
      <Text style={styles.pageTitle}>Preferiti</Text>
      {renderProductGrid(favoriteProducts)}
    </ScrollView>
  );

  const renderCart = () => (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <Text style={styles.eyebrow}>IL TUO ACQUISTO</Text>
      <Text style={styles.pageTitle}>Carrello</Text>
      {cart.length === 0 ? (
        <View style={styles.emptyPanel}><Text style={styles.emptyPanelIcon}>🛍</Text><Text style={styles.emptyPanelTitle}>Il carrello è vuoto</Text><Text style={styles.emptyText}>Aggiungi i tuoi articoli preferiti: il carrello viene conservato anche offline.</Text><GoldButton title="VAI AL CATALOGO" onPress={() => setTab('catalog')} /></View>
      ) : (
        <>
          {cart.map(item => {
            const p = catalog.find(product => product.id === item.productId) || { id: item.productId, name: item.productId, price: null };
            return (
              <View key={`${item.productId}-${item.size}`} style={styles.cartLine}>
                <View style={styles.cartThumb}><Text style={styles.cartThumbSymbol}>{p.symbol || '✦'}</Text></View>
                <View style={styles.cartInfo}>
                  <Text style={styles.cartName}>{p.name}</Text>
                  <Text style={styles.cartMeta}>Taglia: {item.size} · {money(p.price)}</Text>
                  <View style={styles.quantityRow}>
                    <Pressable style={styles.quantityButton} onPress={() => changeCartQuantity(item.productId, item.size, -1)}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <Pressable style={styles.quantityButton} onPress={() => changeCartQuantity(item.productId, item.size, 1)}><Text style={styles.quantityButtonText}>+</Text></Pressable>
                  </View>
                </View>
                <Pressable onPress={() => setCart(current => current.filter(x => !(x.productId === item.productId && x.size === item.size)))}><Text style={styles.removeText}>Rimuovi</Text></Pressable>
              </View>
            );
          })}
          <View style={styles.cartSummary}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Articoli</Text><Text style={styles.summaryValue}>{cartCount}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Totale prodotti</Text><Text style={styles.summaryValue}>{cartHasUnpriced ? 'Da confermare' : money(cartTotal)}</Text></View>
            <Text style={styles.smallNote}>Spedizione e pagamento vengono definiti nella conferma dell’ordine. I prodotti senza prezzo pubblicato saranno trattati come richiesta di preventivo.</Text>
            <GoldButton title="PROCEDI ALLA RICHIESTA" onPress={openCheckout} />
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderLocalOrders = () => {
    const pendingLocal = orders.filter(order => !order.synced);
    const remoteClientOrders = customerOrders;
    const displayedOrders = sessionUser?.role === 'cliente'
      ? [...remoteClientOrders, ...orders.filter(local => !remoteClientOrders.some(remote => remote.clientOrderId === local.id || remote.id === local.serverId))]
      : orders;
    return (
    <View style={styles.ordersBlock}>
      <Text style={styles.sectionTitle}>I tuoi ordini e le richieste</Text>
      {displayedOrders.length === 0 ? <Text style={styles.emptyText}>Non hai ancora inviato richieste.</Text> : displayedOrders.map(order => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderTopRow}><Text style={styles.orderId}>{order.id}</Text><Text style={[styles.orderState, (order.synced || String(order.id).startsWith('SFO-')) ? styles.orderStateDone : styles.orderStatePending]}>{(order.synced || String(order.id).startsWith('SFO-')) ? 'TRASMESSO' : 'IN ATTESA DI RETE'}</Text></View>
          <Text style={styles.orderMeta}>{new Date(order.createdAt).toLocaleString('it-IT')} · {order.items.length} righe</Text>
          {order.items.map((item, index) => <Text key={`${order.id}-${index}`} style={styles.orderItemText}>{item.quantity || item.qty} × {item.name || item.productId} ({item.size})</Text>)}
          <Text style={styles.orderTotal}>{order.total === null ? 'Importo da confermare' : money(order.total)}</Text>
        </View>
      ))}
    </View>
    );
  };

  const renderStaffPanel = () => (
    <View style={styles.staffPanel}>
      <View style={styles.sectionHeadingRow}><View><Text style={styles.eyebrow}>AREA RISERVATA</Text><Text style={styles.sectionTitle}>Gestione negozio</Text></View><Pressable onPress={() => loadStaffOrders()}><Text style={styles.textLink}>Aggiorna ↻</Text></Pressable></View>
      {!apiConfigured ? <Text style={styles.warningText}>Collega il backend HTTPS per visualizzare gli ordini del negozio.</Text> : null}
      {owner && (
        <View style={styles.adminFormCard}>
          <Text style={styles.formCardTitle}>Pubblica un prodotto</Text>
          <Field label="Nome prodotto" value={productForm.name} onChangeText={v => setProductForm(s => ({ ...s, name: v }))} />
          <Text style={styles.fieldLabel}>Categoria</Text>
          <View style={styles.chipRowWrap}>{CATEGORIES.filter(x => x !== 'Tutti').map(x => <Pressable key={x} onPress={() => setProductForm(s => ({ ...s, category: x }))} style={[styles.miniChip, productForm.category === x && styles.miniChipActive]}><Text style={[styles.miniChipText, productForm.category === x && styles.miniChipTextActive]}>{x}</Text></Pressable>)}</View>
          <Field label="Descrizione" value={productForm.description} onChangeText={v => setProductForm(s => ({ ...s, description: v }))} multiline />
          <View style={styles.twoFields}><View style={styles.twoField}><Field label="Prezzo (€)" value={productForm.price} onChangeText={v => setProductForm(s => ({ ...s, price: v }))} keyboardType="decimal-pad" /></View><View style={styles.twoField}><Field label="Giacenza" value={productForm.stock} onChangeText={v => setProductForm(s => ({ ...s, stock: v }))} keyboardType="number-pad" /></View></View>
          <GoldButton title="PUBBLICA NEL CATALOGO" onPress={createProduct} disabled={!apiConfigured || !online} />
        </View>
      )}
      {owner && (
        <View style={styles.adminFormCard}>
          <Text style={styles.formCardTitle}>Completa prezzi e giacenze</Text>
          <Text style={styles.smallNote}>I prodotti dimostrativi partono senza prezzi e disponibilità. Inserisci i valori reali prima di aprire le vendite.</Text>
          {catalog.map(product => {
            const edit = productEdits[product.id] || { price: product.price === null || product.price === undefined ? '' : String(product.price), stock: product.stock === null || product.stock === undefined ? '' : String(product.stock) };
            return (
              <View key={product.id} style={styles.catalogEditCard}>
                <Text style={styles.catalogEditName}>{product.name}</Text>
                <View style={styles.twoFields}>
                  <View style={styles.twoField}><Field label="Prezzo (€)" value={edit.price} onChangeText={v => setProductEdits(current => ({ ...current, [product.id]: { ...edit, price: v } }))} keyboardType="decimal-pad" /></View>
                  <View style={styles.twoField}><Field label="Giacenza" value={edit.stock} onChangeText={v => setProductEdits(current => ({ ...current, [product.id]: { ...edit, stock: v } }))} keyboardType="number-pad" /></View>
                </View>
                <GoldButton title="SALVA PREZZO / GIACENZA" onPress={() => saveProductEdit(product)} compact disabled={!apiConfigured || !online} />
              </View>
            );
          })}
        </View>
      )}
      {owner && (
        <View style={styles.adminFormCard}>
          <Text style={styles.formCardTitle}>Crea un account di lavoro</Text>
          <Field label="Nome e cognome" value={staffForm.name} onChangeText={v => setStaffForm(s => ({ ...s, name: v }))} />
          <Field label="E-mail" value={staffForm.email} onChangeText={v => setStaffForm(s => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password temporanea" value={staffForm.password} onChangeText={v => setStaffForm(s => ({ ...s, password: v }))} secureTextEntry autoCapitalize="none" />
          <View style={styles.chipRowWrap}>
            <Pressable onPress={() => setStaffForm(s => ({ ...s, role: 'amministrazione-finanze' }))} style={[styles.miniChip, staffForm.role === 'amministrazione-finanze' && styles.miniChipActive]}><Text style={[styles.miniChipText, staffForm.role === 'amministrazione-finanze' && styles.miniChipTextActive]}>Amministrazione e Finanze</Text></Pressable>
            <Pressable onPress={() => setStaffForm(s => ({ ...s, role: 'dipendente' }))} style={[styles.miniChip, staffForm.role === 'dipendente' && styles.miniChipActive]}><Text style={[styles.miniChipText, staffForm.role === 'dipendente' && styles.miniChipTextActive]}>Dipendente</Text></Pressable>
          </View>
          <GoldButton title="CREA ACCOUNT" onPress={createStaffAccount} disabled={!apiConfigured || !online} compact />
          <Text style={styles.smallNote}>L’app non permette di creare altri account Amministratore unico.</Text>
        </View>
      )}
      <Text style={styles.formCardTitle}>Ordini ricevuti</Text>
      {serverOrders.length === 0 ? <Text style={styles.emptyText}>Nessun ordine caricato. Premi Aggiorna quando il backend è collegato.</Text> : serverOrders.map(order => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderTopRow}><Text style={styles.orderId}>{order.id}</Text><Text style={styles.orderState}>{String(order.status || 'ricevuto').replaceAll('_', ' ').toUpperCase()}</Text></View>
          <Text style={styles.orderMeta}>{order.customer?.name || 'Cliente'} · {order.customer?.email || ''}</Text>
          {safeArray(order.items).map((item, index) => <Text key={`${order.id}-${index}`} style={styles.orderItemText}>{item.qty || item.quantity} × {item.name || item.productId} ({item.size || '—'})</Text>)}
          <View style={styles.statusButtons}>
            {['in_preparazione', 'spedito', 'completato'].map(status => <Pressable key={status} onPress={() => setOrderStatus(order.id, status)} style={styles.statusButton}><Text style={styles.statusButtonText}>{status.replaceAll('_', ' ')}</Text></Pressable>)}
          </View>
        </View>
      ))}
      <Text style={styles.smallNote}>Ruoli previsti: Amministratore unico, Amministrazione e Finanze, Dipendenti e Clienti. La creazione di ulteriori amministratori non è disponibile.</Text>
    </View>
  );

  const renderAccount = () => (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>AREA PERSONALE</Text>
      <Text style={styles.pageTitle}>Profilo e ordini</Text>
      {sessionUser ? (
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(sessionUser.name || 'S').slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.profileName}>{sessionUser.name || sessionUser.email}</Text>
          <Text style={styles.profileEmail}>{sessionUser.email}</Text>
          <Text style={styles.rolePill}>{ROLE_LABELS[sessionUser.role] || 'Cliente'}</Text>
          {staff && renderStaffPanel()}
        </View>
      ) : (
        <View style={styles.authCard}>
          <Text style={styles.formCardTitle}>AREA CLIENTE LOCALE</Text>
          <Text style={styles.smallNote}>
            Accesso e registrazione sono gestiti dal profilo locale del dispositivo. Non serve una connessione Internet.
          </Text>
        </View>
      )}
      {!staff && renderLocalOrders()}
    </ScrollView>
  );

  const renderSyncNotice = () => {
    const pending = orders.filter(order => !order.synced).length;
    if (!pending && (!apiConfigured || !online)) return null;
    return (
      <View style={styles.syncNotice}>
        <Text style={styles.syncNoticeText}>{pending ? `${pending} richiesta/e in attesa di sincronizzazione` : 'Connessione al negozio disponibile'}</Text>
        {pending > 0 && apiConfigured && online && <Pressable onPress={syncPendingOrders}><Text style={styles.syncAction}>Invia ora</Text></Pressable>}
      </View>
    );
  };

  const renderContent = () => {
    if (tab === 'catalog') return renderCatalog();
    if (tab === 'favorites') return renderFavorites();
    if (tab === 'cart') return renderCart();
    if (tab === 'account') return renderAccount();
    return renderHome();
  };

  if (!ready) {
    return <SafeAreaView style={styles.loadingScreen}><StatusBar barStyle="light-content" backgroundColor={C.forest} /><Image source={require('./assets/logo.jpg')} style={styles.loadingLogo} /><ActivityIndicator color={C.gold} size="large" /><Text style={styles.loadingText}>SabryFox2025 Lingerie</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.forest} />
      {renderHeader()}
      {renderSyncNotice()}
      <View style={styles.main}>{renderContent()}</View>
      <View style={styles.bottomNav}>
        {[
          ['home', '⌂', 'Home'], ['catalog', '▦', 'Shop'], ['favorites', '♡', 'Preferiti'], ['cart', '🛍', 'Carrello'], ['account', '◎', 'Profilo'],
        ].map(([key, icon, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.navItem}>
            <Text style={[styles.navIcon, tab === key && styles.navIconActive]}>{icon}{key === 'cart' && cartCount > 0 ? ` ${cartCount}` : ''}</Text>
            <Text style={[styles.navLabel, tab === key && styles.navLabelActive]}>{label}</Text>
            {tab === key && <View style={styles.navIndicator} />}
          </Pressable>
        ))}
      </View>

      <Modal visible={Boolean(selectedProduct)} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.productModal}>
            <View style={styles.modalHandle} />
            <Pressable style={styles.modalClose} onPress={() => setSelectedProduct(null)}><Text style={styles.modalCloseText}>×</Text></Pressable>
            {selectedProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <ProductArt product={selectedProduct} large />
                <Text style={styles.eyebrow}>{selectedProduct.category}</Text>
                <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                <Text style={styles.modalProductPrice}>{money(selectedProduct.price)}</Text>
                {!!selectedProduct.description && <Text style={styles.modalDescription}>{selectedProduct.description}</Text>}
                <Text style={styles.fieldLabel}>Seleziona taglia</Text>
                <View style={styles.chipRowWrap}>{safeArray(selectedProduct.sizes, ['Taglia da concordare']).map(size => <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.sizeChip, selectedSize === size && styles.sizeChipActive]}><Text style={[styles.sizeChipText, selectedSize === size && styles.sizeChipTextActive]}>{size}</Text></Pressable>)}</View>
                <Text style={styles.smallNote}>Colore indicativo: {selectedProduct.color || 'da confermare'}. Prezzo e disponibilità sono soggetti a conferma del negozio.</Text>
                <GoldButton title="AGGIUNGI AL CARRELLO" onPress={addToCart} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={checkoutOpen} animationType="slide" onRequestClose={() => setCheckoutOpen(false)}>
        <SafeAreaView style={styles.checkoutSafe}>
          <View style={styles.checkoutHeader}><Text style={styles.checkoutTitle}>Completa la richiesta</Text><Pressable onPress={() => setCheckoutOpen(false)}><Text style={styles.modalCloseText}>×</Text></Pressable></View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.checkoutContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.pageIntro}>Inserisci i dati necessari per essere ricontattata/o e confermare ordine, prezzo, spedizione e pagamento.</Text>
              <Field label="Nome e cognome" value={checkout.name} onChangeText={v => setCheckout(s => ({ ...s, name: v }))} />
              <Field label="E-mail" value={checkout.email} onChangeText={v => setCheckout(s => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Telefono" value={checkout.phone} onChangeText={v => setCheckout(s => ({ ...s, phone: v }))} keyboardType="phone-pad" />
              <Field label="Indirizzo" value={checkout.address} onChangeText={v => setCheckout(s => ({ ...s, address: v }))} />
              <View style={styles.twoFields}><View style={styles.twoField}><Field label="Città" value={checkout.city} onChangeText={v => setCheckout(s => ({ ...s, city: v }))} /></View><View style={styles.twoField}><Field label="CAP" value={checkout.postalCode} onChangeText={v => setCheckout(s => ({ ...s, postalCode: v }))} keyboardType="number-pad" /></View></View>
              <Field label="Note per il negozio (facoltative)" value={checkout.note} onChangeText={v => setCheckout(s => ({ ...s, note: v }))} multiline />
              <View style={styles.consentRow}><Switch value={checkout.privacyAccepted} onValueChange={v => setCheckout(s => ({ ...s, privacyAccepted: v }))} trackColor={{ false: '#C8C0B4', true: C.green }} thumbColor={C.paper} /><Text style={styles.consentText}>Confermo di aver letto l’informativa privacy. I dati saranno usati per gestire questa richiesta.</Text></View>
              {PRIVACY_POLICY_URL ? <Text style={styles.smallNote}>Informativa: {PRIVACY_POLICY_URL}</Text> : <Text style={styles.warningText}>Prima della pubblicazione va inserito il collegamento all’informativa privacy del negozio.</Text>}
              <View style={styles.checkoutTotal}><Text style={styles.summaryLabel}>Totale indicativo</Text><Text style={styles.summaryValue}>{cartHasUnpriced ? 'Da confermare' : money(cartTotal)}</Text></View>
              <Text style={styles.smallNote}>Questa versione invia una richiesta d’ordine, non incassa pagamenti con carta. Il pagamento online richiede l’attivazione di un gestore e delle relative credenziali del titolare.</Text>
              <GoldButton title={busy ? 'INVIO IN CORSO…' : 'INVIA RICHIESTA'} onPress={completeCheckout} disabled={busy} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  loadingScreen: { flex: 1, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loadingLogo: { width: 150, height: 150, borderRadius: 22 },
  loadingText: { color: C.goldLight, fontSize: 16, letterSpacing: 2 },
  header: { minHeight: 76, backgroundColor: C.forest, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.gold },
  headerTitle: { color: C.goldLight, fontSize: 16, fontWeight: '800', letterSpacing: 0.6 },
  headerSubtitle: { color: '#EAD9B6', fontSize: 9, letterSpacing: 3, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#B66A62' },
  connectionDotOn: { backgroundColor: '#6CC18A' },
  connectionText: { fontSize: 9, fontWeight: '800', color: '#E5D8C2', letterSpacing: 0.5 },
  headerCart: { marginLeft: 8, width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#9B7B43', alignItems: 'center', justifyContent: 'center' },
  headerCartIcon: { color: C.goldLight, fontSize: 22 },
  cartBadge: { position: 'absolute', right: -2, top: -4, minWidth: 16, height: 16, borderRadius: 9, backgroundColor: C.bronze, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  syncNotice: { backgroundColor: '#EDE1C9', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncNoticeText: { color: '#654A2B', fontSize: 11 },
  syncAction: { color: C.forest, fontWeight: '800', fontSize: 11 },
  main: { flex: 1 },
  pageContent: { padding: 16, paddingBottom: 34 },
  hero: { backgroundColor: C.forest, minHeight: 252, borderRadius: 18, padding: 22, marginBottom: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#9B7741' },
  heroTopLine: { width: 44, height: 2, backgroundColor: C.gold, marginBottom: 16 },
  heroEyebrow: { color: C.gold, fontSize: 9, letterSpacing: 2.2, fontWeight: '800' },
  heroTitle: { color: C.paper, fontSize: 29, fontWeight: '700', lineHeight: 34, marginTop: 14, maxWidth: '82%' },
  heroCopy: { color: '#E3D9C7', fontSize: 12, lineHeight: 19, marginTop: 10, marginBottom: 18, maxWidth: '88%' },
  heroSeal: { position: 'absolute', right: -22, bottom: -30, width: 132, height: 132, borderRadius: 70, borderWidth: 1, borderColor: '#8C6A39', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  heroSealText: { color: 'rgba(214,173,98,0.28)', fontSize: 52, fontWeight: '900', letterSpacing: -5 },
  eyebrow: { color: '#9A7B47', fontWeight: '800', fontSize: 9, letterSpacing: 2, marginBottom: 5 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: C.ink, fontSize: 21, fontWeight: '800' },
  pageTitle: { color: C.ink, fontSize: 30, fontWeight: '800', marginBottom: 8 },
  pageIntro: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  textLink: { color: C.bronze, fontSize: 12, fontWeight: '800' },
  chipRow: { gap: 8, paddingBottom: 16 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  categoryChip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, backgroundColor: '#E8DECD', borderWidth: 1, borderColor: '#D9C9AD' },
  categoryChipActive: { backgroundColor: C.forest, borderColor: C.gold },
  categoryChipText: { color: '#66543D', fontSize: 11, fontWeight: '700' },
  categoryChipTextActive: { color: C.goldLight },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  productGridItem: { width: '50%', paddingHorizontal: 6, marginBottom: 13 },
  productCard: { backgroundColor: C.paper, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.line, minHeight: 255 },
  productArtWrap: { position: 'relative' },
  productArt: { height: 148, backgroundColor: '#E8DDCA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productArtLarge: { height: 210, borderRadius: 14, marginBottom: 18 },
  artHalo: { width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(154,123,71,0.6)', position: 'absolute' },
  productSymbol: { color: C.bronze, fontSize: 52, fontWeight: '300' },
  productSymbolLarge: { fontSize: 78 },
  artBrand: { position: 'absolute', bottom: 10, fontSize: 7, letterSpacing: 2, color: '#917D5C' },
  productCategoryTag: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(8,23,16,0.88)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  productCategoryText: { color: C.goldLight, fontSize: 8, fontWeight: '800' },
  productCardBody: { padding: 10, paddingBottom: 12 },
  productName: { color: C.ink, fontSize: 13, fontWeight: '800', minHeight: 34 },
  productPrice: { color: C.bronze, fontSize: 12, fontWeight: '800', marginTop: 5 },
  productAvailability: { color: C.muted, fontSize: 9, marginTop: 4 },
  favoriteButton: { position: 'absolute', right: 8, top: 8, width: 29, height: 29, borderRadius: 15, backgroundColor: 'rgba(255,254,251,0.94)', alignItems: 'center', justifyContent: 'center' },
  favoriteIcon: { color: C.ink, fontSize: 18 },
  favoriteActive: { color: C.bronze },
  serviceStrip: { flexDirection: 'row', backgroundColor: '#E7DDCC', borderRadius: 14, padding: 14, gap: 14, marginTop: 12 },
  serviceItem: { flex: 1 },
  serviceIcon: { color: '#98713A', fontSize: 22, marginBottom: 5 },
  serviceTitle: { color: C.ink, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  serviceCopy: { color: C.muted, fontSize: 10, lineHeight: 15 },
  disclaimer: { color: '#8B8173', fontSize: 10, lineHeight: 15, marginTop: 16 },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, marginVertical: 8 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: '#66543D', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: C.ink, fontSize: 13 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  goldButton: { backgroundColor: C.gold, borderRadius: 10, minHeight: 47, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 8, borderWidth: 1, borderColor: '#C59B4E' },
  goldButtonText: { color: C.forest, fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#BCA77E' },
  secondaryButtonText: { color: C.forest2 },
  compactButton: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 15 },
  compactButtonText: { fontSize: 9 },
  disabledButton: { opacity: 0.45 },
  pressedButton: { opacity: 0.78 },
  emptyPanel: { alignItems: 'center', backgroundColor: C.paper, borderRadius: 15, borderColor: C.line, borderWidth: 1, padding: 24, marginTop: 10 },
  emptyPanelIcon: { color: C.gold, fontSize: 42 },
  emptyPanelTitle: { color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 8 },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomColor: C.line, borderBottomWidth: 1 },
  cartThumb: { width: 64, height: 70, backgroundColor: '#E7DDCA', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cartThumbSymbol: { fontSize: 30, color: C.bronze },
  cartInfo: { flex: 1 },
  cartName: { color: C.ink, fontWeight: '800', fontSize: 13 },
  cartMeta: { color: C.muted, fontSize: 10, marginTop: 3 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  quantityButton: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E6DCCB', alignItems: 'center', justifyContent: 'center' },
  quantityButtonText: { color: C.ink, fontSize: 17, lineHeight: 19 },
  quantityValue: { color: C.ink, fontWeight: '800', fontSize: 12 },
  removeText: { color: C.bronze, fontSize: 9, fontWeight: '700' },
  cartSummary: { backgroundColor: C.paper, borderRadius: 14, padding: 16, borderColor: C.line, borderWidth: 1, marginTop: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: C.muted, fontSize: 12 },
  summaryValue: { color: C.ink, fontSize: 13, fontWeight: '900' },
  smallNote: { color: '#817565', fontSize: 10, lineHeight: 15, marginVertical: 9 },
  ordersBlock: { marginTop: 22 },
  orderCard: { backgroundColor: C.paper, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 13, marginTop: 10 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  orderId: { color: C.ink, fontWeight: '900', fontSize: 12, flex: 1 },
  orderState: { color: C.bronze, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  orderStateDone: { color: C.green },
  orderStatePending: { color: '#956A28' },
  orderMeta: { color: C.muted, fontSize: 10, marginTop: 5, marginBottom: 5 },
  orderItemText: { color: '#4D443A', fontSize: 10, marginTop: 3 },
  orderTotal: { color: C.bronze, fontWeight: '800', fontSize: 11, marginTop: 8 },
  profileCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 16, alignItems: 'center' },
  profileAvatar: { width: 58, height: 58, borderRadius: 30, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center', borderColor: C.gold, borderWidth: 1 },
  profileAvatarText: { color: C.goldLight, fontSize: 23, fontWeight: '800' },
  profileName: { color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 10 },
  profileEmail: { color: C.muted, fontSize: 11, marginTop: 3 },
  rolePill: { color: C.bronze, fontSize: 10, fontWeight: '900', marginTop: 9, backgroundColor: '#E9E0D0', paddingVertical: 6, paddingHorizontal: 11, borderRadius: 12 },
  staffPanel: { width: '100%', marginTop: 22, alignSelf: 'stretch' },
  warningText: { color: '#956A28', fontSize: 10, lineHeight: 15, marginVertical: 8 },
  adminFormCard: { backgroundColor: '#F0E8D9', borderRadius: 13, padding: 13, marginVertical: 12 },
  formCardTitle: { color: C.ink, fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  twoFields: { flexDirection: 'row', gap: 9 },
  twoField: { flex: 1 },
  miniChip: { backgroundColor: '#E6D8C0', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 9 },
  miniChipActive: { backgroundColor: C.forest },
  miniChipText: { color: C.muted, fontSize: 9, fontWeight: '700' },
  miniChipTextActive: { color: C.goldLight },
  catalogEditCard: { backgroundColor: C.paper, borderRadius: 11, borderWidth: 1, borderColor: C.line, padding: 10, marginTop: 9 },
  catalogEditName: { color: C.ink, fontSize: 12, fontWeight: '900', marginBottom: 8 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  statusButton: { borderWidth: 1, borderColor: '#CDBB9D', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9 },
  statusButtonText: { color: C.forest, fontSize: 9, fontWeight: '800' },
  authCard: { backgroundColor: C.paper, borderRadius: 15, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 8 },
  authTabs: { flexDirection: 'row', backgroundColor: '#E9E0D0', borderRadius: 10, padding: 3, marginBottom: 16 },
  authTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  authTabActive: { backgroundColor: C.forest },
  authTabText: { color: C.muted, fontSize: 11, fontWeight: '800' },
  authTabTextActive: { color: C.goldLight },
  bottomNav: { minHeight: 62, backgroundColor: C.forest, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 4 : 0, borderTopWidth: 1, borderTopColor: '#705B39' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 58 },
  navIcon: { color: '#AFA58F', fontSize: 19, fontWeight: '700' },
  navIconActive: { color: C.goldLight },
  navLabel: { color: '#B9B09E', fontSize: 9, marginTop: 2 },
  navLabelActive: { color: C.goldLight, fontWeight: '800' },
  navIndicator: { position: 'absolute', top: 0, height: 2, width: 21, backgroundColor: C.gold, borderRadius: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  productModal: { maxHeight: '92%', backgroundColor: C.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingTop: 15 },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 3, backgroundColor: '#CFC4B3', marginBottom: 13 },
  modalClose: { position: 'absolute', right: 16, top: 12, zIndex: 2, width: 34, height: 34, borderRadius: 18, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: C.ink, fontSize: 28, lineHeight: 30 },
  modalProductName: { color: C.ink, fontSize: 25, fontWeight: '900', marginBottom: 5 },
  modalProductPrice: { color: C.bronze, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  modalDescription: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 15 },
  sizeChip: { borderWidth: 1, borderColor: '#D8CDBB', backgroundColor: C.paper, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10 },
  sizeChipActive: { backgroundColor: C.forest, borderColor: C.gold },
  sizeChipText: { color: C.ink, fontSize: 11, fontWeight: '800' },
  sizeChipTextActive: { color: C.goldLight },
  checkoutSafe: { flex: 1, backgroundColor: C.cream },
  checkoutHeader: { backgroundColor: C.forest, minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutTitle: { color: C.goldLight, fontSize: 17, fontWeight: '900' },
  checkoutContent: { padding: 18, paddingBottom: 30 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  consentText: { color: C.muted, fontSize: 10, lineHeight: 15, flex: 1 },
  checkoutTotal: { backgroundColor: '#E8DECC', borderRadius: 11, padding: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});


export default function App() {
  return (
    <AuthGate>
      {(session) => (
        session && session.role !== 'Cliente'
          ? <ManagementDashboard session={session} />
          : <BoutiqueApp authSession={session} />
      )}
    </AuthGate>
  );
}
