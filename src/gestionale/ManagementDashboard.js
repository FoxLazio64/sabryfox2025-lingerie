import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackupManager from './BackupManager';
import MarketCatalog from './MarketCatalog';
import DemoOrders from './DemoOrders';

const C = {
  dark: '#21121B',
  plum: '#3D1B2D',
  gold: '#C9A66B',
  light: '#E7D4AC',
  cream: '#FBF6F2',
  white: '#FFFDFC',
  muted: '#8B777E',
  line: '#EADFE0',
  green: '#47765D',
  red: '#9B4C50',
};

const KEYS = {
  products: '@sabryfox/gestionale/products',
  movements: '@sabryfox/gestionale/movements',
  finance: '@sabryfox/gestionale/finance',
};

const CATEGORIES = [
  'Reggiseni',
  'Slip e mutandine',
  'Completi e coordinati',
  'Body e corsetteria',
  'Lingerie da notte',
  'Homewear',
  'Calze e collant',
  'Reggicalze e accessori',
  'Intimo modellante',
  'Premaman e allattamento',
  'Lingerie sposa',
  'Moda mare',
  'Intimo uomo',
];

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A858B"
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function Button({ title, onPress, secondary, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        danger && s.danger,
      ]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function Card({ children }) {
  return <View style={s.card}>{children}</View>;
}

function Section({ title, copy }) {
  return (
    <View style={s.section}>
      <Text style={s.title}>{title}</Text>
      {!!copy && <Text style={s.copy}>{copy}</Text>}
      <View style={s.rule} />
    </View>
  );
}

function euro(value) {
  return Number(value || 0).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

export default function ManagementDashboard({ session }) {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('Riepilogo');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [finance, setFinance] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);

  const [code, setCode] = useState('');
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  const [movementCode, setMovementCode] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementType, setMovementType] = useState('Entrata');
  const [movementReason, setMovementReason] = useState('');

  const [financeType, setFinanceType] = useState('Entrata');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeNote, setFinanceNote] = useState('');

  const owner = session.role === 'Amministratore unico';
  const office = session.role === 'Amministrazione e Finanze';
  const employee = session.role === 'Dipendenti';

  const canManageProducts = owner || office;
  const canManageFinance = owner || office;

  const menu = owner
    ? ['Riepilogo', 'Ordini demo', 'Magazzino', 'Movimenti', 'Finanze', 'Catalogo di mercato', 'Impostazioni']
    : office
      ? ['Riepilogo', 'Magazzino', 'Movimenti', 'Finanze', 'Impostazioni']
      : ['Riepilogo', 'Magazzino', 'Movimenti', 'Impostazioni'];

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const values = await AsyncStorage.multiGet(Object.values(KEYS));
        const stored = Object.fromEntries(values);

        if (!active) return;

        setProducts(JSON.parse(stored[KEYS.products] || '[]'));
        setMovements(JSON.parse(stored[KEYS.movements] || '[]'));
        setFinance(JSON.parse(stored[KEYS.finance] || '[]'));
      } catch {
        Alert.alert(
          'Archivio gestionale',
          'Non è stato possibile leggere alcuni dati locali.'
        );
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;

    AsyncStorage.multiSet([
      [KEYS.products, JSON.stringify(products)],
      [KEYS.movements, JSON.stringify(movements)],
      [KEYS.finance, JSON.stringify(finance)],
    ]).catch(() => {
      Alert.alert('Salvataggio', 'Impossibile salvare le ultime modifiche.');
    });
  }, [ready, products, movements, finance]);

  const totalPieces = products.reduce(
    (sum, item) => sum + Number(item.quantity || 0), 0
  );

  const balance = finance.reduce(
    (sum, item) => sum + (item.type === 'Entrata' ? item.amount : -item.amount),
    0
  );

  const addProduct = () => {
    if (!(owner || office)) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per inserire prodotti.');
    }
    const q = Number(quantity);
    const buy = purchasePrice.trim() ? Number(purchasePrice.replace(',', '.')) : 0;
    const sell = salePrice.trim() ? Number(salePrice.replace(',', '.')) : 0;

    if (!code.trim() || !productName.trim()) {
      return Alert.alert('Dati mancanti', 'Inserisci codice e nome del prodotto.');
    }
    if (!Number.isInteger(q) || q < 0) {
      return Alert.alert('Quantità non valida', 'Inserisci una quantità intera.');
    }
    if (
      (purchasePrice.trim() && (!Number.isFinite(buy) || buy < 0)) ||
      (salePrice.trim() && (!Number.isFinite(sell) || sell < 0))
    ) {
      return Alert.alert('Prezzo non valido', 'Controlla i prezzi inseriti.');
    }

    const normalizedCode = code.trim().toUpperCase();

    if (products.some((p) => p.code === normalizedCode)) {
      return Alert.alert('Codice esistente', 'Utilizza un codice articolo diverso.');
    }

    const item = {
      id: String(Date.now()),
      code: normalizedCode,
      name: productName.trim(),
      category,
      size: size.trim(),
      color: color.trim(),
      quantity: q,
      purchasePrice: buy,
      salePrice: sell,
      updatedAt: new Date().toISOString(),
    };

    setProducts((old) => [...old, item]);

    if (q > 0) {
      setMovements((old) => [{
        id: String(Date.now()) + '-initial',
        productCode: normalizedCode,
        productName: item.name,
        type: 'Entrata',
        quantity: q,
        reason: 'Carico iniziale',
        createdAt: new Date().toISOString(),
        user: session.name,
      }, ...old]);
    }

    setCode('');
    setProductName('');
    setSize('');
    setColor('');
    setQuantity('1');
    setPurchasePrice('');
    setSalePrice('');
    Alert.alert('Prodotto inserito', 'Articolo aggiunto al magazzino.');
  };

  const recordMovement = () => {
    if (!(owner || office || employee)) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per registrare movimenti.');
    }
    const q = Number(movementQuantity);
    const product = products.find(
      (p) => p.code === movementCode.trim().toUpperCase()
    );

    if (!product) {
      return Alert.alert('Prodotto non trovato', 'Controlla il codice articolo.');
    }

    if (!Number.isInteger(q) || q <= 0) {
      return Alert.alert('Quantità non valida', 'Inserisci un numero intero positivo.');
    }

    if (movementType === 'Uscita' && q > product.quantity) {
      return Alert.alert('Scorta insufficiente', 'Non puoi scaricare più pezzi di quelli disponibili.');
    }

    const delta = movementType === 'Entrata' ? q : -q;

    setProducts((old) => old.map((p) =>
      p.id === product.id
        ? { ...p, quantity: Number(p.quantity) + delta, updatedAt: new Date().toISOString() }
        : p
    ));

    setMovements((old) => [{
      id: String(Date.now()),
      productCode: product.code,
      productName: product.name,
      type: movementType,
      quantity: q,
      reason: movementReason.trim() || 'Movimento magazzino',
      createdAt: new Date().toISOString(),
      user: session.name,
    }, ...old]);

    setMovementCode('');
    setMovementQuantity('1');
    setMovementReason('');

    Alert.alert('Movimento registrato', 'La giacenza è stata aggiornata.');
  };

  const addFinance = () => {
    if (!canManageFinance) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per registrare operazioni finanziarie.');
    }
    const amount = Number(financeAmount.replace(',', '.'));

    if (!Number.isFinite(amount) || amount <= 0 || !financeNote.trim()) {
      return Alert.alert('Dati mancanti', 'Inserisci importo e descrizione.');
    }

    setFinance((old) => [{
      id: String(Date.now()),
      type: financeType,
      amount,
      note: financeNote.trim(),
      createdAt: new Date().toISOString(),
      user: session.name,
    }, ...old]);

    setFinanceAmount('');
    setFinanceNote('');
    Alert.alert('Registrazione completata', 'Movimento finanziario salvato.');
  };

  const renderSummary = () => (
    <>
      <Section title="Pannello aziendale" copy="Riepilogo delle attività SabryFox2025." />
      <View style={s.stats}>
        <Card>
          <Text style={s.statNumber}>{products.length}</Text>
          <Text style={s.statLabel}>ARTICOLI</Text>
        </Card>
        <Card>
          <Text style={s.statNumber}>{totalPieces}</Text>
          <Text style={s.statLabel}>PEZZI IN MAGAZZINO</Text>
        </Card>
        {canManageFinance && (
          <Card>
            <Text style={s.statNumber}>{euro(balance)}</Text>
            <Text style={s.statLabel}>SALDO REGISTRATO</Text>
          </Card>
        )}
        <Card>
          <Text style={s.statNumber}>{movements.length}</Text>
          <Text style={s.statLabel}>MOVIMENTI MERCE</Text>
        </Card>
      </View>

      <Section title="Accesso attivo" />
      <Card>
        <Text style={s.cardTitle}>{session.name}</Text>
        <Text style={s.goldText}>{session.role}</Text>
        <Text style={s.copy}>
          Le funzioni disponibili dipendono dal livello di accesso assegnato.
        </Text>
      </Card>

      <Section title="Accesso rapido" />
      {menu.filter((x) => x !== 'Riepilogo').map((item) => (
        <Pressable key={item} style={s.menuCard} onPress={() => setPage(item)}>
          <Text style={s.menuText}>{item}</Text>
          <Text style={s.goldText}>APRI  ›</Text>
        </Pressable>
      ))}
    </>
  );

  const renderInventory = () => (
    <>
      <Section title="Magazzino lingerie" copy="Prodotti, varianti e disponibilità." />

      {canManageProducts && (
        <Card>
          <Text style={s.cardTitle}>Nuovo articolo</Text>
          <Field label="CODICE ARTICOLO" value={code} onChangeText={setCode} placeholder="SF-0001" />
          <Field label="NOME PRODOTTO" value={productName} onChangeText={setProductName} placeholder="Nome del capo" />

          <Text style={s.label}>CATEGORIA</Text>
          <Pressable style={s.select} onPress={() => setCategoryOpen(!categoryOpen)}>
            <Text style={s.selectText}>{category}  {categoryOpen ? '▲' : '▼'}</Text>
          </Pressable>

          {categoryOpen && (
            <View style={s.categoryList}>
              {CATEGORIES.map((item) => (
                <Pressable key={item} style={s.categoryOption} onPress={() => {
                  setCategory(item);
                  setCategoryOpen(false);
                }}>
                  <Text style={s.categoryText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Field label="TAGLIA" value={size} onChangeText={setSize} placeholder="Es. 3B, M, L, XL" />
          <Field label="COLORE" value={color} onChangeText={setColor} placeholder="Es. Nero" />
          <Field label="QUANTITÀ INIZIALE" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <Field label="PREZZO DI ACQUISTO (€)" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
          <Field label="PREZZO DI VENDITA (€)" value={salePrice} onChangeText={setSalePrice} keyboardType="decimal-pad" />
          <Button title="INSERISCI NEL MAGAZZINO" onPress={addProduct} />
        </Card>
      )}

      <Section title="Articoli disponibili" />
      {products.length === 0 ? (
        <Card><Text style={s.copy}>Il magazzino è ancora vuoto. Gli articoli appariranno qui dopo il primo inserimento.</Text></Card>
      ) : products.map((item) => (
        <Card key={item.id}>
          <View style={s.productTop}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={[s.stock, item.quantity <= 2 && s.lowStock]}>
              {item.quantity} pz
            </Text>
          </View>
          <Text style={s.goldText}>{item.code} · {item.category}</Text>
          <Text style={s.copy}>
            Taglia: {item.size || '—'} · Colore: {item.color || '—'}
          </Text>
          {owner || office ? (
            <Text style={s.copy}>
              Acquisto: {euro(item.purchasePrice)} · Vendita: {euro(item.salePrice)}
            </Text>
          ) : (
            <Text style={s.copy}>
              Prezzo di vendita: {euro(item.salePrice)}
            </Text>
          )}
          {owner && (
            <Button title="ELIMINA ARTICOLO" danger secondary onPress={() => {
              Alert.alert('Eliminare articolo?', item.name, [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Elimina', style: 'destructive', onPress: () => {
                  setProducts((old) => old.filter((p) => p.id !== item.id));
                }},
              ]);
            }} />
          )}
        </Card>
      ))}
    </>
  );

  const renderMovements = () => (
    <>
      <Section title="Carico e scarico merce" copy="Registra ogni movimento di magazzino." />
      <Card>
        <Text style={s.cardTitle}>Nuovo movimento</Text>
        <Field label="CODICE ARTICOLO" value={movementCode} onChangeText={setMovementCode} placeholder="Inserisci codice articolo" />
        <Text style={s.label}>TIPO MOVIMENTO</Text>
        <View style={s.choiceRow}>
          {['Entrata', 'Uscita'].map((type) => (
            <Pressable key={type} onPress={() => setMovementType(type)}
              style={[s.choice, movementType === type && s.choiceActive]}>
              <Text style={[s.choiceText, movementType === type && s.choiceTextActive]}>{type}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="QUANTITÀ" value={movementQuantity} onChangeText={setMovementQuantity} keyboardType="number-pad" />
        <Field label="CAUSALE" value={movementReason} onChangeText={setMovementReason} placeholder="Acquisto, vendita, reso..." />
        <Button title="REGISTRA MOVIMENTO" onPress={recordMovement} />
      </Card>

      <Section title="Ultimi movimenti" />
      {movements.length === 0 ? (
        <Card><Text style={s.copy}>Nessun movimento registrato.</Text></Card>
      ) : movements.slice(0, 100).map((item) => (
        <Card key={item.id}>
          <View style={s.productTop}>
            <Text style={s.cardTitle}>{item.productName}</Text>
            <Text style={[s.stock, item.type === 'Uscita' && s.lowStock]}>
              {item.type === 'Entrata' ? '+' : '−'}{item.quantity}
            </Text>
          </View>
          <Text style={s.goldText}>{item.type} · {item.productCode}</Text>
          <Text style={s.copy}>{item.reason} · {item.user}</Text>
          <Text style={s.date}>{new Date(item.createdAt).toLocaleString('it-IT')}</Text>
        </Card>
      ))}
    </>
  );

  const renderFinance = () => (
    <>
      <Section title="Amministrazione e Finanze" copy="Registro interno delle entrate e delle uscite." />
      <Card>
        <Text style={s.statNumber}>{euro(balance)}</Text>
        <Text style={s.statLabel}>SALDO DEL REGISTRO</Text>
        <Text style={s.copy}>Saldo calcolato dalle registrazioni inserite nell'app.</Text>
      </Card>

      <Card>
        <Text style={s.cardTitle}>Nuova registrazione</Text>
        <View style={s.choiceRow}>
          {['Entrata', 'Uscita'].map((type) => (
            <Pressable key={type} onPress={() => setFinanceType(type)}
              style={[s.choice, financeType === type && s.choiceActive]}>
              <Text style={[s.choiceText, financeType === type && s.choiceTextActive]}>{type}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="IMPORTO (€)" value={financeAmount} onChangeText={setFinanceAmount} keyboardType="decimal-pad" />
        <Field label="DESCRIZIONE" value={financeNote} onChangeText={setFinanceNote} placeholder="Descrizione movimento" />
        <Button title="SALVA REGISTRAZIONE" onPress={addFinance} />
      </Card>

      <Section title="Storico finanziario" />
      {finance.length === 0 ? (
        <Card><Text style={s.copy}>Nessuna registrazione finanziaria presente.</Text></Card>
      ) : finance.slice(0, 100).map((item) => (
        <Card key={item.id}>
          <View style={s.productTop}>
            <Text style={s.cardTitle}>{item.note}</Text>
            <Text style={[s.stock, item.type === 'Uscita' && s.lowStock]}>
              {item.type === 'Entrata' ? '+' : '−'}{euro(item.amount)}
            </Text>
          </View>
          <Text style={s.copy}>{item.type} · {item.user}</Text>
          <Text style={s.date}>{new Date(item.createdAt).toLocaleString('it-IT')}</Text>
        </Card>
      ))}
    </>
  );

  const renderSettings = () => (
    <>
      <Section title="Impostazioni" copy="Configurazione del profilo aziendale." />
      <Card>
        <Text style={s.cardTitle}>{session.name}</Text>
        <Text style={s.goldText}>{session.role}</Text>
        <Text style={s.copy}>Account attivo su questo dispositivo.</Text>
      </Card>
      <Card>
        <Text style={s.cardTitle}>SabryFox2025 Lingerie</Text>
        <Text style={s.copy}>Versione gestionale in sviluppo.</Text>
        <Text style={s.goldText}>© 2026 SabryFox2025 Lingerie. Tutti i diritti riservati.</Text>
      </Card>
      {owner ? <BackupManager /> : null}
    </>
  );

  if (!ready) {
    return <View style={s.root}><Text style={s.goldText}>Caricamento gestionale...</Text></View>;
  }

  let content;

  switch (page) {
    case 'Magazzino': content = renderInventory(); break;
    case 'Movimenti': content = renderMovements(); break;
    case 'Finanze':
      content = canManageFinance
        ? renderFinance()
        : renderSummary();
      break;
    case 'Ordini demo': content = owner || office ? <DemoOrders /> : renderSummary(); break;
      case 'Catalogo di mercato': content = owner ? <MarketCatalog /> : renderSummary(); break;
    case 'Impostazioni': content = renderSettings(); break;
    default: content = renderSummary();
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={s.logo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>SABRYFOX2025</Text>
          <Text style={s.subtitle}>LINGERIE · GESTIONALE</Text>
        </View>
        <Pressable style={s.gear} onPress={() => setPage('Impostazioni')}>
          <Text style={s.gearText}>⚙</Text>
        </Pressable>
      </View>

      <ScrollView horizontal style={s.navigation} showsHorizontalScrollIndicator={false}>
        {menu.map((item) => (
          <Pressable key={item} onPress={() => setPage(item)}
            style={[s.navButton, page === item && s.navActive]}>
            <Text style={[s.navText, page === item && s.navTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner}
        keyboardShouldPersistTaps="handled">
        {content}
        <View style={s.footer}>
          <Text style={s.footerText}>© 2026 SabryFox2025 Lingerie. Tutti i diritti riservati.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  header: {
    minHeight: 65, backgroundColor: C.dark, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, gap: 9,
  },
  logo: { width: 48, height: 48 },
  brand: { color: C.light, fontFamily: 'Georgia', fontSize: 18, letterSpacing: 1.4 },
  subtitle: { color: C.gold, fontSize: 15, letterSpacing: 2, marginTop: 3 },
  gear: {
    width: 35, height: 35, borderRadius: 20, borderWidth: 1,
    borderColor: C.gold, alignItems: 'center', justifyContent: 'center',
  },
  gearText: { fontSize: 21, color: C.light },
  navigation: { maxHeight: 46, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  navButton: { paddingHorizontal: 14, paddingVertical: 13 },
  navActive: { borderBottomWidth: 2, borderBottomColor: C.gold },
  navText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  navTextActive: { color: C.plum },
  content: { flex: 1 },
  contentInner: { padding: 13, paddingBottom: 12 },
  section: { marginTop: 12, marginBottom: 12 },
  title: { color: C.dark, fontFamily: 'Georgia', fontSize: 28 },
  copy: { color: C.muted, fontSize: 16, lineHeight: 24, marginTop: 5 },
  rule: { width: 43, height: 2, backgroundColor: C.gold, marginTop: 9 },
  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 13,
    borderWidth: 1, borderColor: C.line, marginBottom: 10,
  },
  cardTitle: { color: C.dark, fontFamily: 'Georgia', fontSize: 19 },
  goldText: { color: '#9A7440', fontSize: 16, fontWeight: '700', marginTop: 5 },
  stats: { gap: 2 },
  statNumber: { color: C.plum, fontFamily: 'Georgia', fontSize: 28, fontWeight: '700' },
  statLabel: { color: C.muted, fontSize: 15, letterSpacing: 1.3, marginTop: 5 },
  menuCard: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 14, marginBottom: 9,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  menuText: { color: C.dark, fontSize: 17, fontWeight: '700' },
  field: { marginBottom: 10 },
  label: { color: '#895F38', fontSize: 15, fontWeight: '800', letterSpacing: 1.1, marginBottom: 5 },
  input: {
    backgroundColor: C.cream, borderWidth: 1, borderColor: C.line,
    borderRadius: 9, padding: 11, color: C.dark, fontSize: 17,
  },
  select: { padding: 12, backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 9, marginBottom: 9 },
  selectText: { color: C.plum, fontSize: 16 },
  categoryList: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 10, marginBottom: 10 },
  categoryOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  categoryText: { color: C.dark, fontSize: 16 },
  button: { backgroundColor: C.plum, padding: 13, borderRadius: 22, alignItems: 'center', marginTop: 8 },
  buttonText: { color: C.light, fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  secondary: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.red },
  danger: { borderColor: C.red },
  secondaryText: { color: C.red },
  productTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stock: { color: C.green, fontWeight: '900', fontSize: 17 },
  lowStock: { color: C.red },
  choiceRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  choice: { flex: 1, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: C.gold, alignItems: 'center' },
  choiceActive: { backgroundColor: C.plum },
  choiceText: { color: C.plum, fontSize: 16 },
  choiceTextActive: { color: C.light, fontWeight: '800' },
  date: { color: C.muted, fontSize: 15, marginTop: 7 },
  footer: { alignItems: 'center', paddingVertical: 23 },
  footerText: { color: C.muted, fontSize: 15, textAlign: 'center' },
});
