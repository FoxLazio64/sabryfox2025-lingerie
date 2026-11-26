import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getOrDownloadFullImage } from './mediaCacheService';

export default function FullImagePreview({ item, onClose }) {
  const [loading, setLoading] = useState(true);
  const [localUri, setLocalUri] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function resolveImage() {
      setLoading(true);
      setErrorMsg('');
      const res = await getOrDownloadFullImage(item);
      if (!active) return;
      if (res.uri) {
        setLocalUri(res.uri);
        setSourceLabel(res.fromCache ? 'Salvata sul dispositivo (cache locale)' : 'Scaricata dal web e salvata in locale');
      } else {
        setErrorMsg(res.error || 'Immagine non disponibile');
      }
      setLoading(false);
    }
    resolveImage();
    return () => {
      active = false;
    };
  }, [item]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{item?.name}</Text>
      {loading && <ActivityIndicator size="large" />}
      {!loading && localUri && (
        <>
          <Image source={{ uri: localUri }} style={styles.photo} resizeMode="contain" />
          <Text style={styles.meta}>{sourceLabel}</Text>
        </>
      )}
      {!loading && !localUri && <Text style={styles.err}>{errorMsg}</Text>}
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>Chiudi</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  photo: { width: '100%', height: 360, borderRadius: 8 },
  meta: { marginTop: 8, fontSize: 12, opacity: 0.75 },
  err: { color: '#b00020', marginVertical: 12, textAlign: 'center' },
  btn: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6, backgroundColor: '#222' },
  btnText: { color: '#fff', fontWeight: '600' },
});
