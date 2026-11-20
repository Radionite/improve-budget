export type GroupId = 'vast' | 'leven' | 'sparen';

export type CategoryKey =
  | 'wonen' | 'energie' | 'verzekering' | 'abo' | 'vervoer' | 'opvang' | 'studieschuld' | 'lening'
  | 'boodschappen' | 'dieren' | 'kleding' | 'verzorging' | 'vrijetijd' | 'zakouders' | 'zakkind' | 'overig'
  | 'buffer' | 'beleggen' | 'studiekind' | 'vakantie' | 'aankopen';

/** Categorieën voor transacties: budgetcategorieën plus inkomen en eigen rekening. */
export type TxCategory = CategoryKey | 'inkomen' | 'eigen';

export const GROUPS: { id: GroupId; name: string; desc: string; color: string }[] = [
  { id: 'vast', name: 'Vaste lasten', desc: 'Wonen, energie, verzekeringen, vervoer, opvang en aflossingen', color: '#4F7BE8' },
  { id: 'leven', name: 'Leven & variabel', desc: 'Dagelijkse uitgaven, huisdieren, kleding en zakgeld', color: '#E89B54' },
  { id: 'sparen', name: 'Sparen & beleggen', desc: 'Buffer, beleggingen, studiepotjes en spaardoelen', color: '#A9C1F5' },
];

export const CATEGORIES: { key: CategoryKey; name: string; group: GroupId }[] = [
  { key: 'wonen', name: 'Huur / hypotheek', group: 'vast' },
  { key: 'energie', name: 'Energie & water', group: 'vast' },
  { key: 'verzekering', name: 'Verzekeringen', group: 'vast' },
  { key: 'abo', name: 'Internet, abonnementen & bank', group: 'vast' },
  { key: 'vervoer', name: 'Vervoer & auto', group: 'vast' },
  { key: 'opvang', name: 'Kinderopvang & school', group: 'vast' },
  { key: 'studieschuld', name: 'Studieschuld (DUO)', group: 'vast' },
  { key: 'lening', name: 'Autolening & overige leningen', group: 'vast' },
  { key: 'boodschappen', name: 'Boodschappen', group: 'leven' },
  { key: 'dieren', name: 'Huisdieren', group: 'leven' },
  { key: 'kleding', name: 'Kleding & kleedgeld', group: 'leven' },
  { key: 'verzorging', name: 'Persoonlijke verzorging', group: 'leven' },
  { key: 'vrijetijd', name: 'Uit eten & vrije tijd', group: 'leven' },
  { key: 'zakouders', name: 'Zakgeld ouders', group: 'leven' },
  { key: 'zakkind', name: 'Zakgeld kinderen', group: 'leven' },
  { key: 'overig', name: 'Cadeaus & overig', group: 'leven' },
  { key: 'buffer', name: 'Noodbuffer', group: 'sparen' },
  { key: 'beleggen', name: 'Beleggen', group: 'sparen' },
  { key: 'studiekind', name: 'Studiesparen kinderen', group: 'sparen' },
  { key: 'vakantie', name: 'Vakantie', group: 'sparen' },
  { key: 'aankopen', name: 'Grote aankopen', group: 'sparen' },
];

export const TX_CATEGORY_NAMES: Record<TxCategory, string> = {
  inkomen: 'Inkomen',
  eigen: 'Eigen rekening (telt niet mee)',
  ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c.name])),
} as Record<TxCategory, string>;

export const groupOf = (key: string): GroupId | null =>
  CATEGORIES.find((c) => c.key === key)?.group ?? null;
