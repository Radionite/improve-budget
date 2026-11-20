// Exporteert de hele Firestore-database (alle collecties en subcollecties) naar één JSON-bestand.
// Gebruik: FIREBASE_SERVICE_ACCOUNT='<json>' node backup.mjs backup.json
import { writeFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}');
if (!sa.project_id) {
  console.error('FIREBASE_SERVICE_ACCOUNT ontbreekt of is ongeldig.');
  process.exit(1);
}
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const encode = (v) => {
  if (v instanceof Timestamp) return { __timestamp: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
};

let docs = 0;
async function dumpCollection(ref) {
  const out = {};
  for (const d of (await ref.get()).docs) {
    docs++;
    const entry = { data: encode(d.data()) };
    const subs = await d.ref.listCollections();
    if (subs.length) {
      entry.collections = {};
      for (const s of subs) entry.collections[s.id] = await dumpCollection(s);
    }
    out[d.id] = entry;
  }
  return out;
}

const dump = { app: 'gezinsbank-backup', version: 1, project: sa.project_id, exportedAt: new Date().toISOString(), collections: {} };
for (const c of await db.listCollections()) dump.collections[c.id] = await dumpCollection(c);

writeFileSync(process.argv[2] ?? 'backup.json', JSON.stringify(dump));
console.log(`Back-up gemaakt: ${docs} documenten.`);
