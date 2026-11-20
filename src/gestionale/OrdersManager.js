import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';

const C = {
  dark: '#21121B',
  plum: '#3D1B2D',
  gold: '#C9A66B',
  cream: '#FBF6F2',
  white: '#FFFDFC',
  muted: '#8B777E',
  line: '#EADFE0',
  red: '#9B4C50',
};

const euro = (n) => Number(n || 0).toLocaleString('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="sentences"
      />
    </View>
  );
}

function Button({ title, onPress, secondary, danger, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function OrdersManager({
  products = [],
  orders = [],
  onConfirmOrder,
  onRegisterPayment,
  onCancelOrder,
}) {
  const [customer, setCustomer] = useState('');
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const addItem = () => {
    const code = productCode.trim().toUpperCase();
    const product = products.find(
      (p) => String(p.code || '').toUpperCase() === code
    );
    const q = Number(quantity);

    if (!product) {
      return Alert.alert('Articolo non trovato', 'Inserisci il codice di un articolo presente in magazzino.');
    }

    if (!Number.isInteger(q) || q <= 0) {
      return Alert.alert('Quantità non valida', 'Inserisci un numero intero positivo.');
    }

    const previous = items.find((item) => item.productId === product.id);
    const alreadyAdded = previous ? previous.quantity : 0;

    if (alreadyAdded + q > Number(product.quantity || 0)) {
      return Alert.alert('Scorta insufficiente', 'La quantità richiesta supera la disponibilità in magazzino.');
    }

    const price = Number(product.salePrice || 0);
    if (!Number.isFinite(price) || price <= 0) {
      return Alert.alert('Prezzo mancante', 'Inserisci il prezzo di vendita nella scheda dell’articolo.');
    }

    setItems((old) => {
      const found = old.find((item) => item.productId === product.id);
      if (found) {
        return old.map((item) => item.productId === product.id
          ? { ...item, quantity: item.quantity + q }
          : item
        );
      }

      return [...old, {
        key: product.id,
        productId: product.id,
        code: product.code,
        name: product.name,
        size: product.size || '',
        color: product.color || '',
        quantity: q,
        unitPrice: price,
      }];
    });

    setProductCode('');
    setQuantity('1');
  };

  const submitOrder = async () => {
    if (!customer.trim() || items.length === 0) {
      return Alert.alert('Dati mancanti', 'Inserisci il cliente e almeno un articolo.');
    }

    if (saving) return;
    setSaving(true);

    try {
      const saved = await onConfirmOrder({
        customer: customer.trim(),
        items: items.map(({ key, ...item }) => item),
      });

      if (saved) {
        setCustomer('');
        setProductCode('');
        setQuantity('1');
        setItems([]);
      }
    } catch {
      Alert.alert('Errore', 'Non è stato possibile registrare l’ordine.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={s.heading}>Registro ordini</Text>
      <Text style={s.description}>
        Inserisci soltanto ordini effettivi. Gli articoli devono essere presenti in magazzino.
      </Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Nuovo ordine</Text>

        <Field
          label="CLIENTE"
          value={customer}
          onChangeText={setCustomer}
          placeholder="Nome e cognome"
        />

        <Field
          label="CODICE ARTICOLO"
          value={productCode}
          onChangeText={setProductCode}
          placeholder="Codice presente in magazzino"
        />

        <Field
          label="QUANTITÀ"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        <Button title="AGGIUNGI ARTICOLO" onPress={addItem} />

        {items.map((item) => (
          <View key={item.key} style={s.line}>
            <View style={{ flex: 1 }}>
              <Text style={s.productName}>{item.name}</Text>
              <Text style={s.muted}>
                {item.code} · {item.size || 'Taglia —'} · {item.color || 'Colore —'}
              </Text>
              <Text style={s.muted}>
                {item.quantity} pezzi × {euro(item.unitPrice)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.price}>
                {euro(item.quantity * item.unitPrice)}
              </Text>
              <Pressable onPress={() =>
                setItems((old) => old.filter((x) => x.key !== item.key))
              }>
                <Text style={s.remove}>RIMUOVI</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={s.totalBox}>
          <Text style={s.label}>TOTALE ORDINE</Text>
          <Text style={s.total}>{euro(total)}</Text>
        </View>

        <Button
          title={saving ? 'SALVATAGGIO...' : 'CONFERMA ORDINE E SCARICA MERCE'}
          onPress={submitOrder}
          disabled={saving || !customer.trim() || items.length === 0}
        />

        <Text style={s.description}>
          La conferma registra le uscite dal magazzino. Il pagamento viene registrato separatamente, soltanto dopo aver ricevuto l’incasso.
        </Text>
      </View>

      <Text style={s.heading}>Storico ordini</Text>

      {orders.length === 0 ? (
        <View style={s.card}>
          <Text style={s.description}>Nessun ordine registrato.</Text>
        </View>
      ) : orders.map((order) => (
        <View key={order.id} style={s.card}>
          <Text style={s.eyebrow}>{order.number}</Text>
          <Text style={s.cardTitle}>{order.customer}</Text>
          <Text style={s.muted}>
            {new Date(order.createdAt).toLocaleString('it-IT')}
          </Text>

          {(order.items || []).map((item, index) => (
            <Text key={order.id + '-' + index} style={s.description}>
              {item.quantity} × {item.name} · {item.code}
            </Text>
          ))}

          <Text style={s.total}>{euro(order.total)}</Text>
          <Text style={s.status}>
            ORDINE: {order.status} · PAGAMENTO: {order.paymentStatus}
          </Text>

          {order.status !== 'Annullato' && order.paymentStatus !== 'Pagato' && (
            <>
              <Button
                title="REGISTRA INCASSO RICEVUTO"
                secondary
                onPress={() => onRegisterPayment(order)}
              />
              <Button
                title="ANNULLA ORDINE E REINTEGRA MERCE"
                danger
                secondary
                onPress={() => onCancelOrder(order)}
              />
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  heading: {
    color: C.dark, fontSize: 21, fontWeight: '900',
    marginTop: 15, marginBottom: 6,
  },
  description: {
    color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5,
  },
  card: {
    backgroundColor: C.white, borderRadius: 13, borderWidth: 1,
    borderColor: C.line, padding: 13, marginVertical: 7,
  },
  cardTitle: { color: C.dark, fontSize: 14, fontWeight: '900', marginBottom: 5 },
  eyebrow: { color: '#987240', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  field: { marginBottom: 10 },
  label: { color: '#895F38', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  input: {
    backgroundColor: C.cream, borderColor: C.line, borderWidth: 1,
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10,
    color: C.dark, fontSize: 13,
  },
  button: {
    backgroundColor: C.plum, borderRadius: 9, padding: 13,
    alignItems: 'center', marginTop: 9,
  },
  secondary: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.gold },
  danger: { borderColor: C.red },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#F5DFAE', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  secondaryText: { color: C.plum },
  line: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  productName: { color: C.dark, fontSize: 12, fontWeight: '800' },
  muted: { color: C.muted, fontSize: 10, marginTop: 4 },
  price: { color: C.plum, fontSize: 12, fontWeight: '900' },
  remove: { color: C.red, fontSize: 9, fontWeight: '900', marginTop: 7 },
  totalBox: {
    paddingTop: 13, marginTop: 8, borderTopWidth: 1,
    borderTopColor: C.line,
  },
  total: { color: C.dark, fontSize: 20, fontWeight: '900', marginTop: 5 },
  status: { color: C.plum, fontSize: 9, fontWeight: '900', marginTop: 8 },
});
