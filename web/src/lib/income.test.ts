import { describe, expect, it } from 'vitest';
import { budgetIncome, extrasInMonth, extrasPerYear, incomeSources, paidMonths, perMonth, type IncomeSource } from './income';
import type { Household } from './types';

const salaris: IncomeSource = { id: 'a', name: 'Netto salaris', amount: 4800, freq: 'maand', spread: true };
const kb: IncomeSource = { id: 'b', name: 'Kinderbijslag', amount: 600, freq: 'kwartaal', month: 1, spread: true };
const vg: IncomeSource = { id: 'c', name: 'Vakantiegeld', amount: 3000, freq: 'jaar', month: 5, spread: false };
const dm: IncomeSource = { id: 'd', name: '13e maand', amount: 3600, freq: 'jaar', month: 12, spread: true };

describe('inkomsten', () => {
  it('rekent om naar een maandgemiddelde', () => {
    expect(perMonth(salaris)).toBe(4800);
    expect(perMonth(kb)).toBe(200);
    expect(perMonth(dm)).toBe(300);
  });

  it('kwartaal komt 4 keer per jaar, jaarlijks 1 keer', () => {
    expect(paidMonths(kb)).toEqual([1, 4, 7, 10]);
    expect(paidMonths({ ...kb, month: 5 })).toEqual([2, 5, 8, 11]);
    expect(paidMonths(vg)).toEqual([5]);
  });

  it('maandbudget telt alleen wat over het jaar verdeeld wordt', () => {
    expect(budgetIncome([salaris, kb, vg, dm])).toBe(4800 + 200 + 300);
    expect(extrasPerYear([salaris, kb, vg, dm])).toBe(3000);
  });

  it('laat zien wat er in een maand extra binnenkomt', () => {
    expect(extrasInMonth([salaris, kb, vg], 4).map((e) => e.name)).toEqual(['Kinderbijslag']);
    expect(extrasInMonth([salaris, kb, vg], 5).map((e) => e.name)).toEqual(['Vakantiegeld']);
    expect(extrasInMonth([salaris, kb, vg], 6)).toEqual([]);
  });

  it('zet een oud enkel inkomensbedrag om naar een inkomen', () => {
    const h = { income: 4000 } as Household;
    expect(incomeSources(h)).toEqual([{ id: 'salaris', name: 'Netto salaris', amount: 4000, freq: 'maand', spread: true }]);
  });
});
