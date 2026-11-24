import type { StudyLoan } from './studyLoans';
import type { IncomeSource } from './income';
import type { BudgetPct, Situation } from './budget';
import type { Category, TxCategory } from './categories';

export type Household = {
  id: string;
  name: string;
  members: string[];
  memberNames: Record<string, string>;
  inviteCode: string;
  income: number;
  situation: Situation;
  budget: BudgetPct; // oud: percentages; alleen nog gebruikt als startwaarde
  budgetAmounts?: Record<string, number>; // bedrag per categorie per maand (leidend)
  customCategories?: Category[];
  hiddenCategories?: string[];
  /** Categorieën die de gebruiker zelf invult in plaats van automatisch uit Huishouden/Leningen. */
  unlinkedCategories?: string[];
  incomeSources?: IncomeSource[];
  ownIbans: string[];
  invest?: { start: number; monthly: number; rate: number; years: number; infl: number };
  /** Oud: één studieschuld. Nieuw: studyLoans. */
  studyLoan?: { balance: number; rate: number; term: number; extra: number; owner: string };
  studyLoans?: StudyLoan[];
};

export type Person = {
  id: string;
  name: string;
  role: 'adult' | 'child';
  age?: number;
  zakgeld: number; // volwassene: per maand, kind: per week
  kleedgeld: number; // per maand
  studySaved?: number;
  studyMonthly?: number;
  studyGoal?: number;
  studyMode?: 'sparen' | 'beleggen';
};

export type Pet = { id: string; name: string; kind: string; cost: number };

export type Vehicle = {
  id: string;
  name: string;
  kind: string;
  fuel: string;
  tax: number;
  insurance: number;
  energy: number;
  maintenance: number;
  apk: string;
};

export type Loan = {
  id: string;
  name: string;
  kind: string;
  start: number;
  balance: number;
  rate: number;
  monthly: number;
  endYear: number;
  budgetCat: 'wonen' | 'lening';
  link: string;
};

export type Invoice = {
  id: string;
  product: string;
  shop: string;
  date: string;
  amount: number;
  warrantyYears: number;
  remind: boolean;
  fileChunks?: number;
  fileName?: string;
  fileType?: string;
};

export type Statement = {
  id: string;
  fileName: string;
  status: 'uploaden' | 'verwerken' | 'klaar' | 'fout';
  error?: string;
  bank?: string;
  periodFrom?: string;
  periodTo?: string;
  count?: number;
  newCount?: number;
  openCount?: number;
  balanceOk?: boolean | null;
  uploadedBy?: string;
};

export type Transaction = {
  id: string;
  date: string;
  month: string;
  amount: number;
  raw: string;
  kind: string;
  name: string;
  iban: string;
  description: string;
  place: string;
  bank: string;
  cat: TxCategory | '';
  link: string;
  by: 'regel' | 'jij' | '';
  guess: TxCategory | '';
  conf: number;
  alts: TxCategory[];
  statementId: string;
};

export type Rule = { id: string; match: string; iban?: string; cat: TxCategory; link: string; createdBy?: string };
