import { annuity } from './budget';
import type { Household } from './types';

export type StudyLoan = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  term: number; // 35 (vanaf 2015) of 15 (voor 2015)
  extra: number;
  owner: string; // id van een gezinslid
};

export const NEW_STUDY_LOAN: Omit<StudyLoan, 'id'> = { name: 'Studieschuld', balance: 0, rate: 2.5, term: 35, extra: 0, owner: '' };

/** Alle studieschulden; oudere gegevens hebben er één in `studyLoan`. */
export function studyLoansOf(h: Household | null): StudyLoan[] {
  if (!h) return [];
  if (h.studyLoans) return h.studyLoans;
  const old = h.studyLoan;
  return old && old.balance > 0 ? [{ id: 's1', name: 'Studieschuld', ...old }] : [];
}

/** Maandbedrag inclusief extra aflossen. */
export const studyPayment = (sl: StudyLoan) => (sl.balance > 0 ? annuity(sl.balance, sl.rate, sl.term * 12) + (sl.extra || 0) : 0);
