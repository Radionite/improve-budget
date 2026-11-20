/** Omschrijvingen van Nederlandse banken ontleden in soort, tegenpartij, IBAN en plaats. */

const LABELS = ['IBAN:', 'BIC:', 'Naam:', 'Omschrijving:', 'Kenmerk:', 'Machtiging:', 'Incassant:', 'Betalingskenm.:'];
const LABEL_RE = new RegExp(`(${LABELS.map((l) => l.replace('.', '\\.')).join('|')})`);
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/;

export const normalize = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');

function fields(text: string): Record<string, string> {
  const parts = text.split(LABEL_RE);
  const out: Record<string, string> = {};
  for (let i = 1; i < parts.length - 1; i += 2) {
    const label = parts[i].replace(/:$/, '').toLowerCase();
    if (!(label in out)) out[label] = normalize(parts[i + 1]);
  }
  return out;
}

export type DescriptionInfo = { kind: string; name: string; iban: string; description: string; place: string };

export function parseDescription(raw: string): DescriptionInfo {
  const text = normalize(raw);
  const r: DescriptionInfo = { kind: '', name: '', iban: '', description: '', place: '' };

  // Pinbetaling: "BEA, Betaalpas Winkelnaam,PAS261 NR:ABC123, 06.01.26/16:49 PLAATS"
  let m = text.match(/^(BEA|GEA),\s*(?:Betaalpas|Apple Pay|Google Pay)?\s*(.*?),\s*PAS\s?\d+\s+NR:\s?\S+,?\s*(\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2})?\s*(.*)$/);
  if (m) {
    r.kind = m[1] === 'GEA' ? 'Geldautomaat' : 'Betaalpas';
    r.name = m[2].trim();
    r.place = m[4].trim();
    return r;
  }

  m = text.match(/^SEPA\s+(iDEAL|Overboeking|Incasso algemeen doorlopend|Incasso algemeen eenmalig|Incasso|Periodieke overb\.|Acceptgirobetaling)\b/);
  if (m) {
    r.kind = m[1] === 'iDEAL' ? 'iDEAL' : m[1].startsWith('Incasso') ? 'Incasso' : 'Overboeking';
    const f = fields(text);
    const iban = (f.iban ?? '').replace(/\s/g, '').toUpperCase();
    r.iban = IBAN_RE.test(iban) ? iban : '';
    r.name = f.naam ?? '';
    r.description = f.omschrijving ?? '';
    return r;
  }

  if (/^ABN AMRO Bank N\.V\./.test(text) || /^(Kosten|Rente)\b/.test(text)) {
    return { ...r, kind: 'Bankkosten', name: 'Bank', description: text };
  }
  return { ...r, kind: 'Overig', name: text.slice(0, 60), description: text };
}
