# SabryFox2025 Lingerie — app Android

Progetto **React Native / Expo nativo**: non è un sito web e non usa una pagina web incorporata. È predisposto per la creazione di un APK Android installabile.

## Cosa contiene

- Home boutique con identità SabryFox2025 e logo ufficiale.
- Catalogo con categorie, ricerca, schede prodotto, selezione taglia e preferiti.
- Borsa/carrello con quantità e richiesta d'ordine.
- Profilo locale con recapiti del cliente e richieste salvate.
- Stato ONLINE/OFFLINE. Catalogo iniziale, preferiti, borsa, profilo e richieste restano disponibili sul dispositivo senza connessione.
- Invio delle richieste tramite WhatsApp quando la rete è disponibile e il numero del negozio è stato configurato.
- Possibilità di collegare un catalogo JSON online; se il server non risponde, resta disponibile il catalogo locale incorporato.
- Icona e schermata di avvio create usando il logo fornito.

## Importante prima della pubblicazione

Questo progetto contiene una **base dimostrativa del catalogo**: i nomi dei capi e le descrizioni in `src/catalog.js` sono esempi editoriali, non attestano prodotti realmente disponibili. Non sono stati forniti prezzi, foto prodotto, taglie/stock reali, recapiti o un sistema di pagamento. I prezzi sono quindi impostati a `null` e mostrati come “Prezzo su richiesta”.

Per trasformarlo nel negozio definitivo:

1. Apri `src/config.js` e inserisci il numero WhatsApp ufficiale (solo cifre, con prefisso internazionale), email, Instagram, indirizzo e orari.
2. Sostituisci i prodotti dimostrativi in `src/catalog.js` con il catalogo reale, comprese descrizioni, taglie e prezzi. Le grafiche dei prodotti sono volutamente segnaposto, non fotografie di articoli reali.
3. Per aggiornare il catalogo da remoto, pubblica un JSON HTTPS conforme a `CATALOGO-ONLINE.example.json` e inserisci il suo indirizzo in `STORE.catalogUrl` in `src/config.js`. In assenza di rete o se il server non risponde, l'app usa il catalogo locale.
4. Prima di vendere online, occorre scegliere e integrare un sistema di pagamento e definire spedizioni, resi, privacy e condizioni di vendita. La versione attuale prepara richieste d'ordine: **non incassa pagamenti** e non conferma automaticamente disponibilità o spedizioni.

## Creazione dell'APK Android con Expo EAS

La configurazione `eas.json` contiene già il profilo `preview` per produrre un file `.apk` installabile direttamente su telefoni Android.

Requisiti: un account Expo, Node.js 22.13 o superiore e una connessione internet durante la preparazione e la build. L'APK viene compilato dai server Expo; non è necessario avere Android Studio/Gradle sul computer.

Da un computer (Windows, macOS o Linux), dopo aver estratto questa cartella:

```bash
cd SabryFox2025-Lingerie-App
npm install
npx expo install --fix
npx expo-doctor
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

Al primo collegamento EAS potrebbe chiedere di associare il progetto al tuo account Expo e di creare le credenziali Android. Conferma la creazione delle credenziali per firmare l'APK. Al termine, Expo mostra un collegamento al file `.apk`: aprilo dal telefono Android e autorizza l'installazione dell'app proveniente da quella fonte.

Per una versione destinata a Google Play, usa il profilo `production`, che produce un Android App Bundle (`.aab`) invece dell'APK diretto.

## Avvio di prova

Dopo `npm install`, puoi avviare il progetto con:

```bash
npx expo start
```

Expo Go può essere utile per controllare il progetto durante lo sviluppo, ma **non sostituisce l'APK autonomo**: l'APK si ottiene con il comando EAS indicato sopra.

## Dati e funzionamento offline

Preferiti, borsa, dati profilo e richieste in sospeso vengono conservati con AsyncStorage sul dispositivo. Non è previsto un account cliente su server. WhatsApp, email e catalogo remoto richiedono una connessione. Una richiesta preparata offline resta salvata e può essere aperta e inviata quando la rete torna disponibile.

## Struttura

- `App.js` — interfaccia e logica dell'app nativa.
- `src/catalog.js` — categorie, prodotti dimostrativi e formato catalogo remoto.
- `src/config.js` — recapiti del negozio e URL del catalogo.
- `assets/logo.png` — logo originale fornito.
- `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png` — risorse Android e schermata di avvio.
- `eas.json` — profili di build APK e Play Store.
