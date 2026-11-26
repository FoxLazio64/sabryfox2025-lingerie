#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = process.cwd();
const dataPath = path.join(root, 'src/gestionale/catalogo-foto-reali.json');
const assetDir = path.join(root, 'assets/catalogo-foto-reali');
const localIndexPath = path.join(root, 'src/gestionale/catalogo-foto-local.js');
const statusPath = path.join(root, 'src/gestionale/catalogo-foto-reali-stato.json');

if (!fs.existsSync(dataPath)) {
  console.error('ERRORE: manca src/gestionale/catalogo-foto-reali.json');
  process.exit(1);
}
if (!fs.existsSync('App.js')) {
  console.error('ERRORE: esegui questo script dalla cartella principale del progetto Expo.');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const manifest = data.manifest || [];
fs.mkdirSync(assetDir, { recursive: true });

function detectExt(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii',0,4) === 'RIFF' && buf.toString('ascii',8,12) === 'WEBP') return 'webp';
  if (buf.length > 6 && (buf.toString('ascii',0,6) === 'GIF87a' || buf.toString('ascii',0,6) === 'GIF89a')) return 'gif';
  return null;
}

function download(item, index) {
  return new Promise(resolve => {
    const temp = path.join(assetDir, `.tmp-${item.id}`);
    const referer = item.referer || new URL(item.url).origin + '/';
    const args = [
      '-f', '-L', '-sS', '--retry', '2', '--retry-delay', '1',
      '--connect-timeout', '20', '--max-time', '60',
      '-A', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      '-e', referer, '-o', temp, item.url
    ];
    const child = spawn('curl', args, { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 65000);
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ id: item.id, ok: false, error: err.message });
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || !fs.existsSync(temp)) {
        try { fs.unlinkSync(temp); } catch (_) {}
        resolve({ id: item.id, ok: false, error: `curl exit ${code}` });
        return;
      }
      let buf;
      try { buf = fs.readFileSync(temp); } catch (e) {
        resolve({ id: item.id, ok: false, error: 'lettura file non riuscita' });
        return;
      }
      const ext = detectExt(buf);
      if (!ext || buf.length < 2500) {
        try { fs.unlinkSync(temp); } catch (_) {}
        resolve({ id: item.id, ok: false, error: 'contenuto non riconosciuto come immagine o troppo piccolo' });
        return;
      }
      const file = `photo-${String(index + 1).padStart(3,'0')}.${ext}`;
      const dest = path.join(assetDir, file);
      try {
        fs.renameSync(temp, dest);
        resolve({ id: item.id, ok: true, file, bytes: buf.length });
      } catch (e) {
        resolve({ id: item.id, ok: false, error: e.message });
      }
    });
  });
}

async function main() {
  const available = [];
  const failed = [];
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < manifest.length) {
      const i = cursor++;
      const result = await download(manifest[i], i);
      if (result.ok) {
        available.push(result);
        console.log(`OK ${result.id} -> ${result.file}`);
      } else {
        failed.push(result);
        console.log(`NON DISPONIBILE ${result.id}: ${result.error}`);
      }
    }
  }
  await Promise.all(Array.from({length: concurrency}, worker));

  const byId = Object.fromEntries(available.map(x => [x.id, x.file]));
  let indexCode = `// Generato dall'installatore foto SabryFox2025. Non modificare a mano.\nconst PHOTO = {\n`;
  for (const [id, file] of Object.entries(byId)) {
    indexCode += `  ${JSON.stringify(id)}: require('../../assets/catalogo-foto-reali/${file}'),\n`;
  }
  indexCode += `};\nexport default PHOTO;\n`;
  fs.writeFileSync(localIndexPath, indexCode);
  const status = {
    updatedAt: new Date().toISOString(),
    expected: manifest.length,
    downloaded: available.length,
    failed: failed.length,
    available,
    failed
  };
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  console.log('\nRISULTATO FOTO REALI');
  console.log(`Foto richieste: ${manifest.length}`);
  console.log(`Foto scaricate e verificate: ${available.length}`);
  console.log(`Foto non raggiungibili: ${failed.length}`);
  console.log('Indice locale creato: src/gestionale/catalogo-foto-local.js');
  if (available.length < 30) {
    console.error('\nMeno di 30 immagini sono state scaricate. Controlla la connessione e ripeti l’installazione.');
    process.exitCode = 2;
  }
}
main().catch(err => { console.error(err); process.exit(1); });
