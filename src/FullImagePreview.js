import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getOrDownloadFullImage } from "./mediaCacheService";

function formatSpecs(item) {
  if (!item) return [];
  const cat = String(item.category || "").toLowerCase();
  const isSexy = cat.includes("sexy") || item.sourceCatalog === "vip";
  const isBody = cat.includes("body");
  const isBabydoll = cat.includes("babydoll") || cat.includes("vestaglia");
  const isSet = cat.includes("complet") || cat.includes("set") || cat.includes("parure");

  const modelType =
    item.modelType ||
    item.cut ||
    (isSet
      ? "Completo coordinato (reggiseno + slip/brasiliana)"
      : isBody
      ? "Body modellante / seduzione"
      : isBabydoll
      ? "Babydoll / sottoveste"
      : "Capo intimo donna");

  const cupSupport =
    item.cupSupport ||
    item.underwire ||
    (isSexy
      ? "Coppe a triangolo / balconcino con ferretto o cuciture sagomate"
      : "Coppe strutturate / imbottitura leggera con supporto");

  const closure =
    item.closure ||
    item.straps ||
    "Spalline regolabili + chiusura posteriore a gancetti / tassello igienico";

  const details =
    item.details ||
    item.sheerness ||
    (isSexy
      ? "Trasparenze mirate, pizzo/tulle, cinturini o dettagli seduzione"
      : "Finiture piatte anti-segno, bordi elastici morbidi");

  const rows = [];
  if (item.brand) rows.push(["Brand", item.brand]);
  if (item.category) rows.push(["Categoria", item.category]);
  if (item.fabric) rows.push(["Tessuto", item.fabric]);
  if (item.lining) rows.push(["Fodera", item.lining]);
  rows.push(["Modello", modelType]);
  rows.push(["Coppe / Struttura", cupSupport]);
  rows.push(["Chiusura / Spalline", closure]);
  rows.push(["Dettagli", details]);
  if (item.size) rows.push(["Taglia", item.size]);
  if (item.color) rows.push(["Colore", item.color]);
  return rows;
}

export default function FullImagePreview({ item, onClose }) {
  const [loading, setLoading] = useState(true);
  const [localUri, setLocalUri] = useState(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    async function resolveImage() {
      setLoading(true);
      setErrorMsg("");
      const res = await getOrDownloadFullImage(item);
      if (!active) return;
      if (res.uri) {
        setLocalUri(res.uri);
        setSourceLabel(res.fromCache ? "Salvata sul dispositivo (cache locale)" : "Scaricata dal web e salvata in locale");
      } else {
        setErrorMsg(res.error || "Immagine non disponibile");
      }
      setLoading(false);
    }
    resolveImage();
    return () => {
      active = false;
    };
  }, [item]);

  const specRows = formatSpecs(item);

  return (
    <ScrollView contentContainerStyle={styles.box} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{item?.name || item?.code || "Dettaglio capo"}</Text>
      {loading && <ActivityIndicator size="large" />}
      {!loading && localUri && (
        <>
          <Image source={{ uri: localUri }} style={styles.photo} resizeMode="contain" />
          <Text style={styles.meta}>{sourceLabel}</Text>
        </>
      )}
      {!loading && !localUri && <Text style={styles.err}>{errorMsg}</Text>}

      {specRows.length > 0 && (
        <View style={styles.specsBox}>
          <Text style={styles.specsHeading}>Scheda tecnica capo</Text>
          {specRows.map(([label, val]) => (
            <View key={label} style={styles.specRow}>
              <Text style={styles.specLabel}>{label}:</Text>
              <Text style={styles.specValue}>{val}</Text>
            </View>
          ))}
        </View>
      )}

      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>Chiudi</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  photo: { width: "100%", height: 340, borderRadius: 8 },
  meta: { marginTop: 8, fontSize: 12, opacity: 0.75 },
  err: { color: "#b00020", marginVertical: 12, textAlign: "center" },
  specsBox: {
    width: "100%",
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  specsHeading: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  specRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  specLabel: { fontSize: 12, fontWeight: "600", marginRight: 4 },
  specValue: { fontSize: 12, flexShrink: 1 },
  btn: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6, backgroundColor: "#222" },
  btnText: { color: "#fff", fontWeight: "600" },
});
