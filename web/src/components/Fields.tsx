import { useEffect, useId, useState } from 'react';
import { num } from '../lib/format';

/** Tekstveld dat pas opslaat bij verlaten (blur) of Enter. */
export function TextField({ label, value, onSave, placeholder, type = 'text', bare = false, hideLabel = false }: {
  label: string; value: string; onSave: (v: string) => void; placeholder?: string; type?: string; bare?: boolean; hideLabel?: boolean;
}) {
  const id = useId();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      <input id={id} className={bare ? 'input bare' : 'input'} type={type} value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </div>
  );
}

export function NumberField({ label, value, onSave, step = 1, min = 0 }: {
  label: string; value: number | undefined; onSave: (v: number) => void; step?: number; min?: number;
}) {
  const id = useId();
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => setV(String(value ?? '')), [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" inputMode="decimal" step={step} min={min} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => num(v) !== value && onSave(num(v))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </div>
  );
}

export function SelectField({ label, value, options, onChange, hideLabel = false }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Invulveld voor een getal met label en de opgemaakte waarde ernaast.
 * (Heette eerder een schuifregelaar; max/minLabel/maxLabel worden niet meer gebruikt.)
 */
export function Slider({ label, value, display, min, step, onChange, hint }: {
  label: string; value: number; display: string; min: number; max?: number; step: number; onChange: (v: number) => void; minLabel?: string; maxLabel?: string; hint?: string;
}) {
  const id = useId();
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor={id} style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>
        <span className="small muted">{display}</span>
      </div>
      <NumberInput id={id} value={value} min={min} step={step} onChange={onChange} />
      {hint && <span className="tiny muted">{hint}</span>}
    </div>
  );
}

/**
 * Getalveld dat meteen doorgeeft wat je typt (komma of punt), zonder te springen
 * tijdens het typen. Waarden buiten min/max worden begrensd.
 */
export function NumberInput({ id, value, onChange, min, max, step = 1, ariaLabel, style }: {
  id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; ariaLabel?: string; style?: React.CSSProperties;
}) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); }, [value, focused]);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <input id={id} aria-label={ariaLabel} className="input" style={style} type="text" inputMode="decimal" value={text}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(n)) onChange(clamp(n));
        else if (e.target.value.trim() === '') onChange(clamp(0));
      }}
      onBlur={() => { setFocused(false); setText(fmt(value)); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = clamp(Math.round((value + (e.key === 'ArrowUp' ? step : -step)) * 100) / 100);
          onChange(next);
          setText(fmt(next));
        }
      }} />
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : '');

export function Segmented<T extends string | number | boolean>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="stack">
      <span className="label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
