import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDate, today, weekDateKeys } from '../lib/domain';
import { getLocale, translations as i18n, useLang } from '../lib/i18n';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function WeekCalendar({
  date,
  setDate,
  loggedDates,
}: {
  date: string;
  setDate: (date: string) => void;
  loggedDates: ReadonlySet<string>;
}) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = i18n[lang];
  const locale = getLocale(lang);
  const days = weekDateKeys(date).map(dateFromKey);
  const currentDate = today();

  const weekLabel =
    days[0].getMonth() === days[6].getMonth()
      ? `${days[0].getDate()}–${days[6].getDate()} ${days[6].toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
      : `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}–${days[6].toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`;

  function moveWeek(amount: number) {
    setDate(shiftDate(date, amount * 7));
  }

  return (
    <section className="week-calendar card panel" aria-label={`${isEn ? 'Weekly calendar' : 'Calendario semanal'}, ${weekLabel}`}>
      <div className="week-calendar-head">
        <div>
          <div className="eyebrow">{t.today.yourWeek}</div>
          <div className="week-range" aria-live="polite">
            {weekLabel}
          </div>
        </div>
        <div className="week-calendar-actions">
          <button className="week-nav-button" type="button" aria-label={t.today.prevWeek} onClick={() => moveWeek(-1)} data-testid="button-week-previous">
            <ChevronLeft size={18} />
          </button>
          <button className="week-nav-button" type="button" aria-label={t.today.nextWeek} onClick={() => moveWeek(1)} data-testid="button-week-next">
            <ChevronRight size={18} />
          </button>
          <button className="week-today-button" type="button" onClick={() => setDate(currentDate)} aria-label={t.today.todayBtn} data-testid="button-week-today">
            {t.today.todayBtn}
          </button>
        </div>
      </div>
      <div className="week-days" role="group" aria-label={isEn ? 'Select a day' : 'Seleccionar un día'}>
        {days.map(day => {
          const key = dateKey(day);
          const isSelected = key === date;
          const isToday = key === currentDate;
          const hasLogs = loggedDates.has(key);
          const weekday = day.toLocaleDateString(locale, { weekday: 'narrow' });
          return (
            <button
              key={key}
              type="button"
              className={`week-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${hasLogs ? ' has-logs' : ''}`}
              aria-label={day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => setDate(key)}
              data-testid={`button-week-day-${key}`}
            >
              <span className="week-day-name" aria-hidden="true">
                {weekday}
              </span>
              <span className="week-day-number" aria-hidden="true">
                {day.getDate()}
              </span>
              <span className="week-day-marker" aria-hidden="true">
                {isToday && <span>{t.today.todayBtn}</span>}
                {hasLogs && <span className="week-day-log-indicator" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="week-calendar-legend">
        <span className="week-day-log-indicator" aria-hidden="true" />
        {t.today.loggedDaysLegend}
      </p>
    </section>
  );
}