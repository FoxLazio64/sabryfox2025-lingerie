import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackupManager from './BackupManager';
import OrdersManager from './OrdersManager';
import { pullGestionaleStateFromCloud, pushGestionaleStateToCloud } from './CloudSyncService';

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
  orders: '@sabryfox/gestionale/orders',
};

const STATE_KEY = '@sabryfox/gestionale/state-v1';

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

const InternalAccountsManager = require('./InternalAccountsManager').default;

export default function ManagementDashboard({ session }) {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('Riepilogo');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [finance, setFinance] = useState([]);
  const [orders, setOrders] = useState([]);
  const mutationQueue = useRef(Promise.resolve());
  const storageHealthy = useRef(true);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);

  const [code, setCode] = useState('');
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('0');
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
    ? ['Riepilogo', 'Ordini', 'Magazzino', 'Movimenti', 'Finanze', 'Impostazioni']
    : office
      ? ['Riepilogo', 'Magazzino', 'Movimenti', 'Finanze', 'Impostazioni']
      : ['Riepilogo', 'Magazzino', 'Movimenti', 'Impostazioni'];

  const clearLegacyStorage = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const oldKeys = Object.values(KEYS).filter((key) => allKeys.includes(key));
      if (oldKeys.length) await AsyncStorage.multiRemove(oldKeys);
    } catch {
      // Il nuovo archivio è già stato scritto: le vecchie chiavi non vengono usate.
    }
  };

  const readPersistedState = async () => {
    const raw = await AsyncStorage.getItem(STATE_KEY);

    if (raw !== null) {
      const state = JSON.parse(raw);
      if (
        !state ||
        state.version !== 1 ||
        !Array.isArray(state.products) ||
        !Array.isArray(state.movements) ||
        !Array.isArray(state.finance) ||
        !Array.isArray(state.orders)
      ) {
        throw new Error('Archivio gestionale unico non valido. I dati non saranno sovrascritti.');
      }

      await clearLegacyStorage();
      const cloudResult = await syncStateWithCloud(state);
      return cloudResult.state;
    }

    // Migrazione: legge i quattro archivi precedenti.
    const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
    const stored = Object.fromEntries(pairs);

    const migrated = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products: JSON.parse(stored[KEYS.products] || '[]'),
      movements: JSON.parse(stored[KEYS.movements] || '[]'),
      finance: JSON.parse(stored[KEYS.finance] || '[]'),
      orders: JSON.parse(stored[KEYS.orders] || '[]'),
    };

    if (
      !Array.isArray(migrated.products) ||
      !Array.isArray(migrated.movements) ||
      !Array.isArray(migrated.finance) ||
      !Array.isArray(migrated.orders)
    ) {
      throw new Error('I vecchi archivi gestionali non sono validi. I dati originali saranno conservati.');
    }

    // Prima scrive il nuovo archivio; solo dopo elimina le vecchie chiavi.
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(migrated));
    await clearLegacyStorage();
    const cloudResult = await syncStateWithCloud(migrated);
    return cloudResult.state;
  };


  const syncStateWithCloud = async (localState, { forcePush = false } = {}) => {
    try {
      const remote = await pullGestionaleStateFromCloud();
      const localHasData =
        (localState.products?.length || 0) +
        (localState.movements?.length || 0) +
        (localState.finance?.length || 0) +
        (localState.orders?.length || 0) > 0;
      const remoteHasData = remote
        ? (remote.products?.length || 0) +
          (remote.movements?.length || 0) +
          (remote.finance?.length || 0) +
          (remote.orders?.length || 0) > 0
        : false;

      const localTime = Date.parse(localState.updatedAt || 0) || 0;
      const remoteTime = remote ? (Date.parse(remote.updatedAt || 0) || 0) : 0;

      if (remote && remoteHasData && (!localHasData || remoteTime > localTime)) {
        const adopted = {
          version: 1,
          updatedAt: remote.updatedAt || new Date().toISOString(),
          products: remote.products,
          movements: remote.movements,
          finance: remote.finance,
          orders: remote.orders,
        };
        await AsyncStorage.setItem(STATE_KEY, JSON.stringify(adopted));
        return { state: adopted, source: "cloud", synced: true };
      }

      if ((localHasData && (!remote || !remoteHasData || localTime >= remoteTime)) || forcePush) {
        const pushed = await pushGestionaleStateToCloud(localState);
        return { state: localState, source: pushed ? "local-pushed" : "local-only", synced: pushed };
      }

      return { state: localState, source: "local", synced: Boolean(remote) };
    } catch {
      return { state: localState, source: "local-offline", synced: false };
    }
  };

  const mutateData = (mutator) => {
    const task = mutationQueue.current.then(async () => {
      if (!ready || !storageHealthy.current) {
        throw new Error('Archivio non disponibile. Non sono state salvate modifiche.');
      }

      const current = await readPersistedState();
      const next = mutator(current);

      if (
        !next ||
        !Array.isArray(next.products) ||
        !Array.isArray(next.movements) ||
        !Array.isArray(next.finance) ||
        !Array.isArray(next.orders)
      ) {
        throw new Error('La modifica non ha prodotto un archivio valido.');
      }

      const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        products: next.products,
        movements: next.movements,
        finance: next.finance,
        orders: next.orders,
      };

      // Una sola scrittura contiene tutti i dati del gestionale.
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(payload));

      try { await pushGestionaleStateToCloud(payload); } catch {}

      // La schermata viene aggiornata solo dopo la scrittura riuscita.
      setProducts(payload.products);
      setMovements(payload.movements);
      setFinance(payload.finance);
      setOrders(payload.orders);

      return payload;
    });

    mutationQueue.current = task.catch(() => undefined);
    return task;
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const stored = await readPersistedState();

        if (!active) return;

        setProducts(stored.products);
        setMovements(stored.movements);
        setFinance(stored.finance);
        setOrders(stored.orders);
      } catch {
        storageHealthy.current = false;
        Alert.alert(
          'Archivio gestionale',
          'Non è stato possibile leggere i dati locali. Non inserire nuovi dati e non cancellare l’app.'
        );
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => { active = false; };
  }, []);



  const runStorageExclusive = (operation) => {
    const task = mutationQueue.current.then(async () => {
      if (!ready || !storageHealthy.current) {
        throw new Error('Archivio non disponibile. Riavvia l’app e verifica i dati.');
      }
      return await operation();
    });

    mutationQueue.current = task.catch(() => undefined);
    return task;
  };

  const totalPieces = products.reduce(
    (sum, item) => sum + Number(item.quantity || 0), 0
  );

  const balance = finance.reduce(
    (sum, item) => sum + (item.type === 'Entrata' ? item.amount : -item.amount),
    0
  );

  const addProduct = async () => {
    if (!canManageProducts) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per inserire prodotti.');
    }

    const q = Number(quantity);
    const buy = purchasePrice.trim() ? Number(purchasePrice.replace(',', '.')) : 0;
    const sell = salePrice.trim() ? Number(salePrice.replace(',', '.')) : 0;
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode || !productName.trim()) {
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

    try {
      await mutateData((current) => {
        if (current.products.some((p) => p.code === normalizedCode)) {
          throw new Error('Codice esistente. Utilizza un codice articolo diverso.');
        }

        const now = new Date().toISOString();
        const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
        const item = {
          id,
          code: normalizedCode,
          name: productName.trim(),
          category,
          size: size.trim(),
          color: color.trim(),
          quantity: q,
          purchasePrice: buy,
          salePrice: sell,
          updatedAt: now,
        };

        const nextMovements = q > 0
          ? [{
              id: id + '-initial',
              productId: id,
              productCode: normalizedCode,
              productName: item.name,
              type: 'Entrata',
              quantity: q,
              reason: 'Carico iniziale',
              createdAt: now,
              user: session.name,
            }, ...current.movements]
          : current.movements;

        return {
          ...current,
          products: [...current.products, item],
          movements: nextMovements,
        };
      });

      setCode('');
      setProductName('');
      setSize('');
      setColor('');
      setQuantity('0');
      setPurchasePrice('');
      setSalePrice('');
      Alert.alert('Prodotto inserito', 'Articolo salvato nel magazzino.');
    } catch (error) {
      Alert.alert('Inserimento non riuscito', error?.message || 'Non è stato possibile salvare il prodotto.');
    }
  };

  const recordMovement = async () => {
    if (!(owner || office || employee)) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per registrare movimenti.');
    }

    const q = Number(movementQuantity);
    const normalizedCode = movementCode.trim().toUpperCase();

    if (!Number.isInteger(q) || q <= 0) {
      return Alert.alert('Quantità non valida', 'Inserisci un numero intero positivo.');
    }

    try {
      await mutateData((current) => {
        const product = current.products.find((p) => p.code === normalizedCode);

        if (!product) throw new Error('Prodotto non trovato. Controlla il codice articolo.');
        if (product.archivedAt) throw new Error('Articolo archiviato. Riattivalo prima di registrare movimenti.');

        const available = Number(product.quantity || 0);
        if (!Number.isInteger(available) || available < 0) {
          throw new Error('Giacenza non valida. Controlla il prodotto.');
        }
        if (!['Entrata', 'Uscita'].includes(movementType)) {
          throw new Error('Tipo di movimento non valido.');
        }
        if (movementType === 'Uscita' && q > available) {
          throw new Error('Scorta insufficiente. Non puoi scaricare più pezzi di quelli disponibili.');
        }

        const now = new Date().toISOString();
        const delta = movementType === 'Entrata' ? q : -q;

        const nextProducts = current.products.map((p) =>
          p.id === product.id
            ? { ...p, quantity: available + delta, updatedAt: now }
            : p
        );

        const entry = {
          id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          type: movementType,
          quantity: q,
          reason: movementReason.trim() || 'Movimento magazzino',
          createdAt: now,
          user: session.name,
        };

        return {
          ...current,
          products: nextProducts,
          movements: [entry, ...current.movements],
        };
      });

      setMovementCode('');
      setMovementQuantity('1');
      setMovementReason('');
      Alert.alert('Movimento registrato', 'La giacenza è stata salvata.');
    } catch (error) {
      Alert.alert('Movimento non registrato', error?.message || 'Non è stato possibile salvare il movimento.');
    }
  };

  const setProductArchived = async (item, archived) => {
    if (!owner) return;

    try {
      await mutateData((current) => {
        const product = current.products.find(
          (p) => String(p.id) === String(item.id)
        );

        if (!product) throw new Error('Articolo non trovato.');
        if (archived && Number(product.quantity || 0) !== 0) {
          throw new Error('La giacenza deve essere esattamente zero prima dell’archiviazione.');
        }

        const now = new Date().toISOString();
        return {
          ...current,
          products: current.products.map((p) =>
            String(p.id) === String(item.id)
              ? { ...p, archivedAt: archived ? now : null, updatedAt: now }
              : p
          ),
        };
      });

      Alert.alert(
        archived ? 'Articolo archiviato' : 'Articolo riattivato',
        archived
          ? 'L’articolo e il suo storico sono stati conservati.'
          : 'L’articolo è nuovamente disponibile.'
      );
    } catch (error) {
      Alert.alert('Operazione non riuscita', error?.message || 'Non è stato possibile salvare la modifica.');
    }
  };

  const addFinance = async () => {
    if (!canManageFinance) {
      return Alert.alert('Accesso negato', 'Non hai i permessi per registrare operazioni finanziarie.');
    }

    const amount = Number(financeAmount.replace(',', '.'));
    const note = financeNote.trim();

    if (!Number.isFinite(amount) || amount <= 0 || !note) {
      return Alert.alert('Dati mancanti', 'Inserisci importo e descrizione.');
    }

    if (!['Entrata', 'Uscita'].includes(financeType)) {
      return Alert.alert('Tipo non valido', 'Seleziona Entrata oppure Uscita.');
    }

    try {
      await mutateData((current) => {
        const entry = {
          id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
          type: financeType,
          amount: Number(amount.toFixed(2)),
          note,
          createdAt: new Date().toISOString(),
          user: session.name,
        };

        return {
          ...current,
          finance: [entry, ...current.finance],
        };
      });

      setFinanceAmount('');
      setFinanceNote('');
      Alert.alert('Registrazione completata', 'Movimento finanziario salvato.');
    } catch (error) {
      Alert.alert('Salvataggio non riuscito', error?.message || 'Non è stato possibile registrare il movimento finanziario.');
    }
  };




  const confirmOrder = async (draft) => {
    if (!owner) return false;

    const customer = String(draft?.customer || '').trim();
    const requestedItems = Array.isArray(draft?.items) ? draft.items : [];

    if (!customer || requestedItems.length === 0) {
      Alert.alert('Dati mancanti', 'Cliente e articoli sono obbligatori.');
      return false;
    }

    let orderNumber = '';

    try {
      await mutateData((current) => {
        const requested = new Map();

        for (const line of requestedItems) {
          const productId = String(line.productId || '');
          const q = Number(line.quantity);
          if (!productId || !Number.isInteger(q) || q <= 0) {
            throw new Error('Controlla le quantità degli articoli dell’ordine.');
          }
          requested.set(productId, (requested.get(productId) || 0) + q);
        }

        const orderItems = [];
        let total = 0;

        for (const [productId, q] of requested.entries()) {
          const product = current.products.find((p) => String(p.id) === productId);

          if (!product) throw new Error('Un articolo non è più presente in magazzino.');
          if (product.archivedAt) throw new Error('Un articolo è archiviato. Riattivalo prima di creare l’ordine.');

          const available = Number(product.quantity || 0);
          if (!Number.isInteger(available) || available < q) {
            throw new Error('Scorta insufficiente per ' + product.name + '.');
          }

          const price = Number(product.salePrice || 0);
          if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Prezzo di vendita mancante per ' + product.name + '.');
          }

          const unitPrice = Number(price.toFixed(2));
          total += q * unitPrice;
          orderItems.push({
            productId: product.id,
            code: product.code,
            name: product.name,
            size: product.size || '',
            color: product.color || '',
            quantity: q,
            unitPrice,
          });
        }

        total = Number(total.toFixed(2));
        const now = new Date().toISOString();
        const stamp = Date.now();
        const id = String(stamp) + '-' + Math.random().toString(36).slice(2, 8);
        const number = 'SF-' + now.slice(0, 10).replace(/-/g, '') + '-' + String(stamp).slice(-5);
        orderNumber = number;

        const order = {
          id,
          number,
          createdAt: now,
          customer,
          items: orderItems,
          total,
          status: 'Confermato',
          paymentStatus: 'Da incassare',
          createdBy: session.name,
        };

        const nextProducts = current.products.map((product) => {
          const line = orderItems.find((item) => String(item.productId) === String(product.id));
          return line
            ? { ...product, quantity: Number(product.quantity) - line.quantity, updatedAt: now }
            : product;
        });

        const newMovements = orderItems.map((item, index) => ({
          id: id + '-USCITA-' + index,
          productId: item.productId,
          productCode: item.code,
          productName: item.name,
          type: 'Uscita',
          quantity: item.quantity,
          reason: 'Vendita ordine ' + number,
          createdAt: now,
          user: session.name,
          orderId: id,
        }));

        return {
          ...current,
          products: nextProducts,
          movements: [...newMovements, ...current.movements],
          orders: [order, ...current.orders],
        };
      });

      Alert.alert(
        'Ordine registrato',
        orderNumber + '\nMerce scaricata dal magazzino. Incasso ancora da registrare.'
      );
      return true;
    } catch (error) {
      Alert.alert('Ordine non registrato', error?.message || 'Verifica gli archivi locali prima di riprovare.');
      return false;
    }
  };

  const registerOrderPayment = (order) => {
    if (!owner) return;

    Alert.alert(
      'Conferma incasso',
      'Hai realmente ricevuto ' + euro(order.total) + ' per l’ordine ' + order.number + '?',
      [
        { text: 'NON ANCORA', style: 'cancel' },
        {
          text: 'SÌ, RICEVUTO',
          onPress: async () => {
            try {
              await mutateData((current) => {
                const currentOrder = current.orders.find((item) => item.id === order.id);

                if (!currentOrder || currentOrder.status === 'Annullato') {
                  throw new Error('Ordine non trovato oppure annullato.');
                }
                if (
                  currentOrder.paymentStatus === 'Pagato' ||
                  current.finance.some((item) => item.orderId === order.id)
                ) {
                  throw new Error('Incasso già registrato. Non verrà creata una seconda entrata.');
                }

                const amount = Number(currentOrder.total);
                if (!Number.isFinite(amount) || amount <= 0) {
                  throw new Error('Importo dell’ordine non valido.');
                }

                const now = new Date().toISOString();
                const nextOrders = current.orders.map((item) =>
                  item.id === order.id
                    ? { ...item, paymentStatus: 'Pagato', paidAt: now }
                    : item
                );

                const entry = {
                  id: order.id + '-INCASSO',
                  type: 'Entrata',
                  amount,
                  note: 'Incasso ordine ' + currentOrder.number + ' - ' + currentOrder.customer,
                  createdAt: now,
                  user: session.name,
                  orderId: order.id,
                };

                return {
                  ...current,
                  orders: nextOrders,
                  finance: [entry, ...current.finance],
                };
              });

              Alert.alert('Incasso registrato', 'Entrata aggiunta alle finanze.');
            } catch (error) {
              Alert.alert('Incasso non registrato', error?.message || 'Verifica lo storico finanziario.');
            }
          },
        },
      ]
    );
  };

  const cancelOrder = (order) => {
    if (!owner) return;

    Alert.alert(
      'Annullare ordine?',
      'La merce verrà reintegrata nel magazzino. Questa operazione è consentita soltanto prima dell’incasso.',
      [
        { text: 'TORNA INDIETRO', style: 'cancel' },
        {
          text: 'ANNULLA E REINTEGRA',
          style: 'destructive',
          onPress: async () => {
            try {
              await mutateData((current) => {
                const currentOrder = current.orders.find((item) => item.id === order.id);

                if (!currentOrder || currentOrder.status === 'Annullato') {
                  throw new Error('L’ordine è già stato annullato oppure non esiste.');
                }
                if (
                  currentOrder.paymentStatus === 'Pagato' ||
                  current.finance.some((item) => item.orderId === order.id)
                ) {
                  throw new Error('Ordine già incassato. È necessaria una procedura separata di rimborso.');
                }

                const quantities = new Map();
                for (const item of currentOrder.items || []) {
                  const productId = String(item.productId || '');
                  const q = Number(item.quantity);
                  if (!productId || !Number.isInteger(q) || q <= 0) {
                    throw new Error('Dati articolo dell’ordine non validi. Reintegro interrotto.');
                  }
                  quantities.set(productId, (quantities.get(productId) || 0) + q);
                }

                for (const productId of quantities.keys()) {
                  if (!current.products.some((p) => String(p.id) === productId)) {
                    throw new Error('Articolo mancante. Impossibile reintegrare la merce.');
                  }
                }

                const now = new Date().toISOString();
                const nextProducts = current.products.map((product) => {
                  const q = quantities.get(String(product.id)) || 0;
                  return q > 0
                    ? { ...product, quantity: Number(product.quantity || 0) + q, updatedAt: now }
                    : product;
                });

                const newMovements = (currentOrder.items || []).map((item, index) => ({
                  id: currentOrder.id + '-REINTEGRO-' + index,
                  productId: item.productId,
                  productCode: item.code,
                  productName: item.name,
                  type: 'Entrata',
                  quantity: item.quantity,
                  reason: 'Reintegro annullamento ordine ' + currentOrder.number,
                  createdAt: now,
                  user: session.name,
                  orderId: currentOrder.id,
                }));

                const nextOrders = current.orders.map((item) =>
                  item.id === order.id
                    ? { ...item, status: 'Annullato', canceledAt: now }
                    : item
                );

                return {
                  ...current,
                  products: nextProducts,
                  movements: [...newMovements, ...current.movements],
                  orders: nextOrders,
                };
              });

              Alert.alert('Ordine annullato', 'La merce è stata reintegrata nel magazzino.');
            } catch (error) {
              Alert.alert('Annullamento non riuscito', error?.message || 'Verifica le giacenze.');
            }
          },
        },
      ]
    );
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

      <Section title="Articoli e archivio" />
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
          {item.archivedAt && (
            <Text style={s.copy}>
              ARTICOLO ARCHIVIATO · Escluso dai nuovi ordini e movimenti
            </Text>
          )}

          {owner && !item.archivedAt && (
            <Button title="ARCHIVIA ARTICOLO" danger secondary onPress={() => {
              Alert.alert(
                'Archiviare articolo?',
                item.name + '\nLo storico e i dati dell’articolo saranno conservati.',
                [
                  { text: 'ANNULLA', style: 'cancel' },
                  {
                    text: 'ARCHIVIA',
                    style: 'destructive',
                    onPress: () => setProductArchived(item, true),
                  },
                ]
              );
            }} />
          )}

          {owner && item.archivedAt && (
            <Button title="RIATTIVA ARTICOLO" secondary onPress={() => {
              Alert.alert(
                'Riattivare articolo?',
                item.name,
                [
                  { text: 'ANNULLA', style: 'cancel' },
                  {
                    text: 'RIATTIVA',
                    onPress: () => setProductArchived(item, false),
                  },
                ]
              );
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


  const handleManualCloudSync = async () => {
    try {
      const current = await readPersistedState();
      const res = await syncStateWithCloud(current, { forcePush: true });
      setProducts(res.state.products);
      setMovements(res.state.movements);
      setFinance(res.state.finance);
      setOrders(res.state.orders);
      Alert.alert(
        "Sincronizzazione cloud",
        res.synced
          ? "Dati allineati con il cloud (modalità: " + res.source + ")."
          : "Dati salvati in locale. Verifica di essere autenticato con l'account proprietario verificato."
      );
    } catch (error) {
      Alert.alert("Sincronizzazione non riuscita", error?.message || "Errore durante la sincronizzazione.");
    }
  };

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
        <Text style={s.goldText}>© 2025 SabryFox2025 Lingerie. Tutti i diritti riservati.</Text>
      </Card>
      {owner ? (
        <Card>
          <Text style={s.cardTitle}>Sincronizzazione Cloud</Text>
          <Text style={s.copy}>Allinea prodotti, movimenti, finanze e ordini tra tablet e smartphone.</Text>
          <Button title="SINCRONIZZA ORA CON CLOUD" onPress={handleManualCloudSync} />
        </Card>
      ) : null}
      {owner ? <InternalAccountsManager session={session} /> : null}
      {owner ? (
        <BackupManager
          runStorageExclusive={runStorageExclusive}
          onRestoreComplete={() => {
            storageHealthy.current = false;
          }}
        />
      ) : null}
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
    case 'Ordini':
      content = owner ? (
        <OrdersManager
          products={products.filter((item) => !item.archivedAt)}
          orders={orders}
          onConfirmOrder={confirmOrder}
          onRegisterPayment={registerOrderPayment}
          onCancelOrder={cancelOrder}
        />
      ) : renderSummary();
      break;
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
          <Text style={s.footerText}>© 2025 SabryFox2025 Lingerie. Tutti i diritti riservati.</Text>
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
