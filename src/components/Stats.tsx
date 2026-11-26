import { Trash2 } from 'lucide-react';
import { addNutrients, sumLogs, targets, type LogEntry, type Nutrients, type Store } from '../lib/domain';
import { getLocale, translations as i18n, useLang } from '../lib/i18n';
import { Empty } from './AppPrimitives';

const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');
const emptyN: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export default function Stats({
  store,
  mode,
  goal,
  onRemoveWeight,
}: {
  store: Store;
  mode: 'Semana' | 'Mes';
  goal: ReturnType<typeof targets>;
  onRemoveWeight: (id: string) => void;
}) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = i18n[lang];
  const locale = getLocale(lang);

  const days = mode === 'Semana' ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);
  const entries = store.logs.filter(l => new Date(`${l.date}T12:00:00`) >= since);
  const byDate = new Map<string, LogEntry[]>();
  entries.forEach(l => byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]));
  const complete = [...byDate.values()].filter(x => ['Desayuno', 'Comida', 'Cena'].every(meal => x.some(l => l.meal === meal)));
  const logged = [...byDate.values()];
  const avg = logged.length ? logged.reduce((n, l) => addNutrients(n, sumLogs(l)), emptyN) : emptyN;
  const average = {
    kcal: avg.kcal / (logged.length || 1),
    protein: avg.protein / (logged.length || 1),
    carbs: avg.carbs / (logged.length || 1),
    fat: avg.fat / (logged.length || 1),
  };
  const dayValues = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date: key, kcal: sumLogs(byDate.get(key) ?? []).kcal, label: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) };
  });
  const max = Math.max(goal.calories, ...dayValues.map(d => d.kcal), 1);
  const weights = store.weights.slice(-8);
  const points = weights.map((w, i) => ({
    x: 16 + i * (268 / Math.max(1, weights.length - 1)),
    y: 140 - ((w.weight - Math.min(...weights.map(a => a.weight), w.weight)) / (Math.max(...weights.map(a => a.weight), w.weight) - Math.min(...weights.map(a => a.weight), w.weight) || 1)) * 100,
  }));

  return (
    <>
      <div className="grid three-col">
        <div className="card panel">
          <div className="eyebrow">{t.stats.completeDays}</div>
          <div className="stat-value" style={{ marginTop: 13 }}>
            {complete.length}
            <span style={{ fontFamily: 'var(--app-font-sans)', fontSize: 14, color: '#829084' }}> / {days}</span>
          </div>
          <p className="small-text muted">{t.stats.completeDaysDesc}</p>
        </div>
        <div className="card panel">
          <div className="eyebrow">{t.stats.avgKcal}</div>
          <div className="stat-value" style={{ marginTop: 13 }}>
            {logged.length ? fmt(average.kcal) : '—'}
          </div>
          <p className="small-text muted">
            {isEn ? `Average across days with at least one entry (${logged.length}).` : `Media de los días con al menos una entrada (${logged.length}).`}
          </p>
        </div>
        <div className="card panel">
          <div className="eyebrow">{t.stats.avgMacros}</div>
          <div style={{ fontSize: 15, fontWeight: 650, marginTop: 15 }}>
            P {logged.length ? fmt(average.protein) : '—'} g · C {logged.length ? fmt(average.carbs) : '—'} g
          </div>
          <p className="small-text muted">
            {isEn ? `Fat ${logged.length ? fmt(average.fat) : '—'} g on average.` : `Grasas ${logged.length ? fmt(average.fat) : '—'} g de media.`}
          </p>
        </div>
      </div>
      <div className="grid two-col" style={{ marginTop: 18 }}>
        <section className="card panel">
          <div className="eyebrow">{t.stats.paceEyebrow}</div>
          <h2 className="serif" style={{ fontSize: 25, margin: '6px 0 15px' }}>
            {t.stats.energyPerDay}
          </h2>
          <div style={{ height: 190, display: 'flex', alignItems: 'end', gap: Math.max(3, 12 - days * 0.25), padding: '8px 0' }}>
            {dayValues
              .filter((_, i) => days === 7 || i % 3 === 0 || i === days - 1)
              .map(d => (
                <div key={d.date} title={`${d.label}: ${fmt(d.kcal)} kcal`} style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'end', alignItems: 'center', height: '100%', gap: 6 }}>
                  <div style={{ height: `${d.kcal ? Math.max(5, (d.kcal / max) * 100) : 2}%`, width: 'min(24px,100%)', borderRadius: '8px 8px 2px 2px', background: d.kcal ? '#81a887' : '#e8e9df' }} data-testid={`bar-calories-${d.date}`} />
                  <span className="small-text muted" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>
                    {d.label}
                  </span>
                </div>
              ))}
          </div>
          <p className="small-text muted">
            {isEn ? 'Reflects logged entries only. An empty slot means nothing was logged that day.' : 'Solo refleja lo anotado. Un espacio sin barra significa que no hay entradas ese día.'}
          </p>
        </section>
        <section className="card panel">
          <div className="eyebrow">{t.stats.trendEyebrow}</div>
          <h2 className="serif" style={{ fontSize: 25, margin: '6px 0 10px' }}>
            {t.stats.weightLogged}
          </h2>
          {weights.length > 1 ? (
            <>
              <svg className="chart" viewBox="0 0 300 170" role="img" aria-label={isEn ? 'Weight trend chart' : 'Gráfico de tendencia de peso'}>
                <path d="M16 150 H284" stroke="#e4e7dc" strokeWidth="1" />
                <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#5b8b68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="4" fill="#5b8b68" />
                ))}
              </svg>
              <div className="small-text muted">
                {weights[0].weight} kg ({weights[0].date}) · {weights.at(-1)?.weight} kg ({weights.at(-1)?.date})
              </div>
            </>
          ) : (
            <Empty title={t.stats.noTrendTitle} text={t.stats.noTrendText} />
          )}
          {store.weights.map(w => (
            <div className="list-row" key={w.id}>
              <span>
                <b>{w.weight} kg</b>
                <span className="small-text muted">
                  {' '}
                  · {w.date}
                  {w.note ? ` · ${w.note}` : ''}
                </span>
              </span>
              <button
                className="icon-button"
                aria-label={isEn ? 'Delete weight' : 'Eliminar peso'}
                onClick={() => {
                  if (window.confirm(isEn ? 'Delete this weigh-in?' : '¿Eliminar esta medición?')) onRemoveWeight(w.id);
                }}
                data-testid={`button-delete-weight-${w.id}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      </div>
      <p className="small-text muted" style={{ marginTop: 17 }}>
        {isEn
          ? 'Your data syncs privately with your account. Averages exclude unlogged days and are not a health assessment.'
          : 'Tus datos se sincronizan con tu cuenta. Las medias no incluyen días sin suficientes entradas y no representan una evaluación de salud.'}
      </p>
    </>
  );
}