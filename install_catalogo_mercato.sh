#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p assets/catalogo-mercato src/gestionale
cp src/gestionale/ManagementDashboard.js "src/gestionale/ManagementDashboard.js.backup-catalogo-mercato"

# Download only public-domain CC0 reference photographs from Wikimedia Commons.
# These are category illustrations, not photos of the exact retailer SKUs.
download(){
  local url="$1" dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 2 --connect-timeout 20 -A 'SabryFox2025-private-catalogue/1.0 (CC0 image import)' "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$dest" "$url"
  else
    echo "Manca curl/wget. Installa curl con: pkg install curl" >&2; exit 1
  fi
  test -s "$dest"
}

download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Underwire_bra%2C_grey.jpg' assets/catalogo-mercato/bra-grey.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Modern_soft_bra%2C_black.jpg' assets/catalogo-mercato/bra-black.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Seemless_Brassiere_-_Bra_-_nahtloser_BH.jpg' assets/catalogo-mercato/bra-seamless.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Retail_bra_display.jpg' assets/catalogo-mercato/bra-display.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Brown_Hourglass_Panties.jpg' assets/catalogo-mercato/panties-brown.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Faux_leather_garter_belt.jpg' assets/catalogo-mercato/garter-belt.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Corset_-_Royal_Worcester_Corset_Company%2C_ca._1885.jpg' assets/catalogo-mercato/corset-historic.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Red_corset%2C_1880s._Barcelona_Museu_del_Disseny_31072016.jpg' assets/catalogo-mercato/corset-red.jpg
download 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Stockings_MET_1989.72.2ab.jpg' assets/catalogo-mercato/stockings-met.jpg

node <<'NODE'
const fs = require('fs');
const f = 'src/gestionale/ManagementDashboard.js';
let code = fs.readFileSync(f, 'utf8');
const importLine = "import AsyncStorage from '@react-native-async-storage/async-storage';";
if (!code.includes("import MarketCatalog from './MarketCatalog';")) {
  if (!code.includes(importLine)) throw new Error('Import AsyncStorage non trovato. File non modificato.');
  code = code.replace(importLine, importLine + "\nimport MarketCatalog from './MarketCatalog';");
}
const oldMenu = `  const menu = owner || office
    ? ['Riepilogo', 'Magazzino', 'Movimenti', 'Finanze', 'Impostazioni']
    : ['Riepilogo', 'Magazzino', 'Movimenti', 'Impostazioni'];`;
const newMenu = `  const menu = owner
    ? ['Riepilogo', 'Magazzino', 'Movimenti', 'Finanze', 'Catalogo di mercato', 'Impostazioni']
    : office
      ? ['Riepilogo', 'Magazzino', 'Movimenti', 'Finanze', 'Impostazioni']
      : ['Riepilogo', 'Magazzino', 'Movimenti', 'Impostazioni'];`;
if (code.includes(oldMenu)) code = code.replace(oldMenu, newMenu);
else if (!code.includes("'Catalogo di mercato'")) throw new Error('Menu gestionale non riconosciuto. File non modificato.');
const switchAnchor = "    case 'Impostazioni': content = renderSettings(); break;";
if (!code.includes("case 'Catalogo di mercato':")) {
  if (!code.includes(switchAnchor)) throw new Error('Switch pagine non riconosciuto. File non modificato.');
  code = code.replace(switchAnchor, "    case 'Catalogo di mercato': content = owner ? <MarketCatalog /> : renderSummary(); break;\n" + switchAnchor);
}
fs.writeFileSync(f, code);
console.log('Catalogo di mercato collegato: visibile solo all’Amministratore unico.');
NODE

COUNT=$(node -e 'const d=require("./src/gestionale/catalogo-mercato.json");console.log(d.products.length)')
echo "Catalogo installato. Modelli: $COUNT"
echo "Backup dashboard: src/gestionale/ManagementDashboard.js.backup-catalogo-mercato"
