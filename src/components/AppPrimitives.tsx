import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

export function Field({ label, test, children }: { label: string; test: string; children: ReactNode }) {
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id: test, 'data-testid': test })
    : children;
  return (
    <div className="field">
      <label htmlFor={test}>{label}</label>
      {control}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <div style={{ fontFamily: 'var(--app-font-serif)', fontSize: 21, marginBottom: 5 }}>{title}</div>
      <div className="small-text muted">{text}</div>
    </div>
  );
}

export function MacroMeter({ name, value, target, color }: { name: string; value: number; target: number; color: string }) {
  const percent = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');
  return (
    <div className="macro-line">
      <span>
        <i className="macro-dot" style={{ background: color }} />
        {name}
      </span>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
      <b style={{ textAlign: 'right' }}>{fmt(value)} g</b>
    </div>
  );
}