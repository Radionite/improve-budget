import { describe, expect, it } from 'vitest';
import { studyLoansOf, studyPayment } from './studyLoans';
import type { Household } from './types';

describe('studieschulden', () => {
  it('zet een oude enkele studieschuld om naar een lijst', () => {
    const h = { studyLoan: { balance: 28000, rate: 2.5, term: 35, extra: 0, owner: '' } } as Household;
    expect(studyLoansOf(h)).toEqual([{ id: 's1', name: 'Studieschuld', balance: 28000, rate: 2.5, term: 35, extra: 0, owner: '' }]);
  });

  it('gebruikt de nieuwe lijst als die er is, ook als hij leeg is', () => {
    const old = { balance: 28000, rate: 2.5, term: 35, extra: 0, owner: '' };
    expect(studyLoansOf({ studyLoan: old, studyLoans: [] } as unknown as Household)).toEqual([]);
  });

  it('maandbedrag telt extra aflossen mee en is 0 zonder schuld', () => {
    const base = { id: 'a', name: 'x', balance: 28000, rate: 2.5, term: 35, extra: 0, owner: '' };
    expect(Math.round(studyPayment(base))).toBe(100);
    expect(Math.round(studyPayment({ ...base, extra: 50 }))).toBe(150);
    expect(studyPayment({ ...base, balance: 0 })).toBe(0);
  });
});
