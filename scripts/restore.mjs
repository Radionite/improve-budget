// Zet een back-up (gemaakt met backup.mjs) terug in Firestore.
// Eerst ontsleutelen, zie README. Gebruik:
//   FIREBASE_SERVICE_ACCOUNT='<json>' node restore.mjs backup.json
// Bestaande documenten met dezelfde id worden overschreven; andere blijven staan.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const file = process.argv[2];
if (!file) {
  console.error('Gebruik: node restore.mjs backup.json');
  process.exit(1);
}
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}');
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const dump = JSON.parse(readFileSync(file, 'utf8'));
if (dump.app !== 'gezinsbank-backup') throw new Error('Dit is geen Gezinsbank-back-up.');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Back-up van ${dump.exportedAt} terugzetten in project ${sa.project_id}? Typ "ja": `);
rl.close();
if (answer.trim().toLowerCase() !== 'ja') process.exit(0);

const decode = (v) => {
  if (v && typeof v === 'object' && '__timestamp' in v) return Timestamp.fromDate(new Date(v.__timestamp));
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
  return v;
};

let writer = db.bulkWriter();
let count = 0;
function restoreCollection(ref, docsMap) {
  for (const [id, entry] of Object.entries(docsMap)) {
    const docRef = ref.doc(id);
    writer.set(docRef, decode(entry.data));
    count++;
    for (const [sub, subDocs] of Object.entries(entry.collections ?? {})) restoreCollection(docRef.collection(sub), subDocs);
  }
}
for (const [name, docsMap] of Object.entries(dump.collections)) restoreCollection(db.collection(name), docsMap);
await writer.close();
console.log(`Teruggezet: ${count} documenten.`);
