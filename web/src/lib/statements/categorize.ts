/**
 * Categorie voorstellen voor een transactie.
 * 1. Overboeking van/naar een eigen rekening -> 'eigen' (telt niet mee).
 * 2. Een geleerde regel (eerder antwoord) -> automatisch ingedeeld.
 * 3. Anders een voorstel op basis van trefwoorden; de gebruiker krijgt een vraag.
 */
import type { TxCategory } from '../categories';
import type { ParsedTransaction } from './model';

const KEYWORDS: [TxCategory, string[]][] = [
  ['boodschappen', ['supermarkt', 'albert heijn', 'ah to go', 'jumbo', 'poiesz', 'lidl', 'aldi', 'plus ', 'coop', 'spar ', 'dirk', 'vomar', 'picnic', 'deen', 'hoogvliet', 'jan linders', 'bakker', 'slager']],
  ['vervoer', ['tamoil', 'shell', 'esso', 'tinq', 'tango', 'tankstation', 'q-park', 'parkeren', 'ns groep', 'ns reizen', 'arriva', 'qbuzz', 'garage', 'anwb', 'kwik-fit', 'autoband']],
  ['energie', ['eneco', 'vattenfall', 'essent', 'greenchoice', 'budget energie', 'vandebron', 'vitens', 'waterbedrijf', 'evides', 'brabant water']],
  ['verzekering', ['verzeker', 'zilveren kruis', 'vgz', 'menzis', 'centraal beheer', 'interpolis', 'fbto', 'nationale-nederlanden', 'ohra', 'univé', 'unive']],
  ['abo', ['ziggo', 'kpn', 'odido', 't-mobile', 'vodafone', 'netflix', 'spotify', 'disney', 'videoland', 'basispakket']],
  ['studieschuld', ['duo', 'dienst uitvoering onderwijs']],
  ['wonen', ['hypotheek', 'huur', 'woonstichting', 'woningcorporatie', 'vve']],
  ['kleding', ['zalando', 'h&m', 'primark', 'c&a', 'zeeman', 'we fashion', 'schoenen', 'only ']],
  ['verzorging', ['kruidvat', 'etos', 'trekpleister', 'da drogist', 'barbier', 'kapper', 'apotheek']],
  ['dieren', ['dierenarts', 'dierenkliniek', 'pets place', 'jumper', 'dierenspeciaal']],
  ['vrijetijd', ['restaurant', 'cafe', 'café', 'eetcafe', 'snackbar', 'pizzeria', 'mcdonald', 'burger king', 'bioscoop', 'pathe', 'pathé', 'steam', 'valve', 'playstation', 'sony interactive', 'nintendo', 'spellekijn', 'jamin', 'bowling']],
  ['overig', ['bol.com', 'amazon', 'hema', 'action', 'bruna', 'gall&gall', 'blokker', 'juwelier']],
  ['opvang', ['kinderopvang', 'bso', 'school', 'ouderbijdrage']],
];

export type RuleLike = { id?: string; match: string; iban?: string; cat: TxCategory; link?: string };
export type Categorized = { cat: TxCategory | ''; link: string; by: 'regel' | ''; guess: TxCategory | ''; conf: number; alts: TxCategory[] };

const norm = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).join(' ');

export function guess(tx: ParsedTransaction): { guess: TxCategory | ''; conf: number; alts: TxCategory[] } {
  const hay = `${norm(`${tx.name} ${tx.description}`)} `;
  const hits = KEYWORDS.filter(([, words]) => words.some((w) => hay.includes(w))).map(([c]) => c);
  if (tx.amount > 0 && !hits.length) return { guess: 'inkomen', conf: 50, alts: ['eigen', 'overig'] };
  if (tx.kind === 'Bankkosten') return { guess: 'abo', conf: 80, alts: ['overig'] };
  if (hits.length) return { guess: hits[0], conf: hits.length === 1 ? 80 : 60, alts: [...hits.slice(1, 3), ...(hits.includes('overig') ? [] : ['overig' as const])] };
  return { guess: '', conf: 0, alts: ['overig', 'vrijetijd', 'boodschappen'] };
}

export function matchRule(tx: ParsedTransaction, rules: RuleLike[]): RuleLike | undefined {
  const name = norm(tx.name);
  const byIban = rules.find((r) => r.iban && tx.iban && r.iban === tx.iban && (!r.match || name.includes(norm(r.match))));
  if (byIban) return byIban;
  return rules.find((r) => {
    const m = norm(r.match ?? '');
    return m && (m === name || (m.length >= 4 && name.includes(m)));
  });
}

export function categorize(tx: ParsedTransaction, rules: RuleLike[], ownIbans: Set<string>): Categorized {
  if (tx.iban && ownIbans.has(tx.iban)) return { cat: 'eigen', link: '', by: 'regel', guess: 'eigen', conf: 100, alts: [] };
  const rule = matchRule(tx, rules);
  if (rule) return { cat: rule.cat, link: rule.link ?? '', by: 'regel', guess: rule.cat, conf: 100, alts: [] };
  return { cat: '', link: '', by: '', ...guess(tx) };
}
