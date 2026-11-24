import { useMemo } from 'react';
import { useCollection, useData } from './data';
import { type Situation } from './budget';
import { studyLoansOf, studyPayment as studyPaymentOf } from './studyLoans';
import type { CategoryKey } from './categories';
import type { Loan, Person, Pet, Vehicle } from './types';

export const WEEKS_PER_MONTH = 52 / 12;

/** Alles wat in Huishouden en Leningen is vastgelegd, omgerekend naar bedragen per maand per budgetpost. */
export function useCommitments() {
  const { household } = useData();
  const people = useCollection<Person>('people');
  const pets = useCollection<Pet>('pets');
  const vehicles = useCollection<Vehicle>('vehicles');
  const loans = useCollection<Loan>('loans');

  return useMemo(() => {
    const adults = people.items.filter((p) => p.role === 'adult');
    const kids = people.items.filter((p) => p.role === 'child');
    const studyPayment = studyLoansOf(household ?? null).reduce((sum, sl) => sum + studyPaymentOf(sl), 0);

    const monthly: Partial<Record<CategoryKey, number>> = {
      zakouders: adults.reduce((s, p) => s + (p.zakgeld || 0), 0),
      zakkind: kids.reduce((s, p) => s + (p.zakgeld || 0), 0) * WEEKS_PER_MONTH,
      kleding: people.items.reduce((s, p) => s + (p.kleedgeld || 0), 0),
      dieren: pets.items.reduce((s, p) => s + (p.cost || 0), 0),
      vervoer: vehicles.items.reduce((s, v) => s + (v.tax || 0) + (v.insurance || 0) + (v.energy || 0) + (v.maintenance || 0), 0),
      studiekind: kids.reduce((s, p) => s + (p.studyMonthly || 0), 0),
      studieschuld: studyPayment,
      wonen: loans.items.filter((l) => l.budgetCat === 'wonen').reduce((s, l) => s + (l.monthly || 0), 0),
      lening: loans.items.filter((l) => l.budgetCat === 'lening').reduce((s, l) => s + (l.monthly || 0), 0),
    };

    const derived: Situation | null = people.items.length
      ? {
          adults: Math.max(1, adults.length),
          kids: kids.length,
          pets: pets.items.length > 0,
          cars: vehicles.items.filter((v) => ['Auto', 'Camper'].includes(v.kind)).length,
        }
      : null;

    const ready = people.ready && pets.ready && vehicles.ready && loans.ready;
    return { monthly, derived, people: people.items, pets: pets.items, vehicles: vehicles.items, loans: loans.items, studyPayment, ready };
  }, [household, people.items, pets.items, vehicles.items, loans.items, people.ready, pets.ready, vehicles.ready, loans.ready]);
}

/** Opties voor 'Hoort bij': gezinsleden, huisdieren en voertuigen. */
export function useLinkOptions() {
  const { people, pets, vehicles } = useCommitments();
  return [
    { value: '', label: 'Gezin algemeen' },
    ...people.map((p) => ({ value: `p:${p.id}`, label: p.name })),
    ...pets.map((p) => ({ value: `d:${p.id}`, label: `${p.name} (${p.kind.toLowerCase()})` })),
    ...vehicles.map((v) => ({ value: `v:${v.id}`, label: v.name })),
  ];
}
