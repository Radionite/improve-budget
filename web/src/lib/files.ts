/**
 * Bestanden (facturen, foto's van bonnen) opslaan in Firestore, zonder Cloud Storage.
 * Zo werkt alles op het gratis Spark-abonnement. Foto's worden eerst verkleind;
 * bestanden worden in stukjes van ~700 kB opgeslagen (een Firestore-document mag max 1 MB zijn).
 */
import { collection, doc, getDocs, orderBy, query, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const CHUNK_CHARS = 700_000;

/** Foto verkleinen naar max 1600 px en opslaan als JPEG. PDF's blijven zoals ze zijn. */
export async function prepareFile(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82));
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Slaat een bestand op onder {parent}/files/{n}. Geeft het aantal stukjes terug. */
export async function saveFile(parent: DocumentReference, blob: Blob): Promise<number> {
  if (blob.size > MAX_FILE_BYTES) throw new Error('Dit bestand is groter dan 8 MB.');
  const b64 = await toBase64(blob);
  const chunks = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
  const batch = writeBatch(db);
  for (let n = 0; n < chunks; n++) {
    batch.set(doc(collection(parent, 'files'), String(n)), { n, data: b64.slice(n * CHUNK_CHARS, (n + 1) * CHUNK_CHARS) });
  }
  await batch.commit();
  return chunks;
}

export async function loadFile(parent: DocumentReference, type: string): Promise<Blob> {
  const snap = await getDocs(query(collection(parent, 'files'), orderBy('n')));
  const b64 = snap.docs.map((d) => d.data().data as string).join('');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

export async function deleteFile(parent: DocumentReference) {
  const snap = await getDocs(collection(parent, 'files'));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
