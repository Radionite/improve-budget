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

export function Slider({ label, value, display, min, max, step, onChange, minLabel, maxLabel }: {
  label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void; minLabel?: string; maxLabel?: string;
}) {
  const id = useId();
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor={id} style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>
        <span className="display strong" style={{ fontSize: 18 }}>{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {(minLabel || maxLabel) && <div className="row tiny muted" style={{ justifyContent: 'space-between' }}><span>{minLabel}</span><span>{maxLabel}</span></div>}
    </div>
  );
}

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
