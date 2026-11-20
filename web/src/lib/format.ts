const eur0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const euro = (n: number) => eur0.format(Number.isFinite(n) ? n : 0);
export const euroCents = (n: number) => eur2.format(Number.isFinite(n) ? n : 0);
export const signedEuro = (n: number) => (n > 0 ? '+ ' : '− ') + eur2.format(Math.abs(n));
export const pct = (n: number, digits = 0) => `${(Number.isFinite(n) ? n : 0).toFixed(digits).replace('.', ',')}%`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
};

export const daysUntil = (iso: string, from = new Date()) =>
  Math.round((new Date(iso).getTime() - new Date(from.toDateString()).getTime()) / 86_400_000);

export const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
