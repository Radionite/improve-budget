import { looksLikeAbnAmro, parseAbnAmro } from './abnAmro';
import type { ParsedStatement } from './model';
import { extractPdf } from './pdfText';

export * from './model';
export { categorize } from './categorize';

export class UnsupportedStatement extends Error {}

/** Leest een afschrift volledig in de browser in; het bestand wordt nergens heen gestuurd. */
export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf') {
    throw new UnsupportedStatement(`Bestandstype .${ext ?? '?'} wordt nog niet ondersteund. Nu: ABN AMRO PDF. ING en ASN volgen zodra er een voorbeeld is.`);
  }
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pages = await extractPdf(pdfjs as never, new Uint8Array(await file.arrayBuffer()));
  const first = pages[0]?.text ?? '';
  if (!first.trim()) throw new UnsupportedStatement('Deze PDF bevat geen tekst (is het een scan?). Download het afschrift opnieuw vanuit internetbankieren.');
  if (looksLikeAbnAmro(first)) return parseAbnAmro(pages);
  throw new UnsupportedStatement('Dit PDF-afschrift wordt nog niet herkend. Nu ondersteund: ABN AMRO "Bij- en afschrijvingen".');
}
