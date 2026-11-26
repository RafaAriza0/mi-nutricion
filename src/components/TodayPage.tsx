import { useRef, useState, type PointerEvent as PointerEventType } from 'react';
import { Activity, CalendarDays, ChevronRight, Copy, GripVertical, Plus, X } from 'lucide-react';
import { addNutrients, foodById, mealNames, multiplyNutrients, recipeFit, recipeMatchesAvoidance, recipeNutrition, recipePreferenceScore, scaled, targets, type Dish, type Food, type LogEntry, type Meal, type Nutrients, type Profile, type Recipe, type Store } from '../lib/domain';
import { foodDisplayName, getLocale, labelMeal, recipeDisplay, translations as i18n, useLang } from '../lib/i18n';
import { Empty, MacroMeter } from './AppPrimitives';
import NutrientSummary from './NutrientSummary';
import WeekCalendar from './WeekCalendar';

const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');
const emptyN: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function calculateDishNutrients(dish: Dish, foods: Food[]): Nutrients {
  const total = dish.ingredients.reduce((nutrients, ingredient) => {
    const food = foodById(ingredient.foodId, foods);
    return food ? addNutrients(nutrients, scaled(food, ingredient.grams)) : nutrients;
  }, emptyN);
  return multiplyNutrients(total, 1 / dish.servings);
}

export default function TodayPage({
  name,
  profile,
  date,
  setDate,
  loggedDates,
  total,
  remaining,
  goal,
  logs,
  hasYesterdayLogs,
  onCopyYesterday,
  foods,
  dishes,
  recipes,
  reminder,
  clockMinute,
  onAdd,
  onDelete,
  onMove,
  onDish,
  onRecipe,
  onNavigate,
}: {
  name: string;
  profile: Profile | null;
  date: string;
  setDate: (d: string) => void;
  loggedDates: ReadonlySet<string>;
  total: Nutrients;
  remaining: Nutrients;
  goal: ReturnType<typeof targets>;
  logs: LogEntry[];
  hasYesterdayLogs: boolean;
  onCopyYesterday: () => void;
  foods: Food[];
  dishes: Dish[];
  recipes: Recipe[];
  reminder: Store['reminder'];
  clockMinute: string;
  onAdd: (foodId?: string, meal?: Meal) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, meal: Meal) => void;
  onDish: (d: Dish) => void;
  onRecipe: (r: Recipe) => void;
  onNavigate: (path: string) => void;
}) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = i18n[lang];
  const locale = getLocale(lang);

  const dragPointer = useRef<{ logId: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const [draggingLogId, setDraggingLogId] = useState<string | null>(null);
  const [dropMeal, setDropMeal] = useState<Meal | null>(null);

  function mealAtPoint(x: number, y: number): Meal | null {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-meal-drop-target]')?.dataset.mealDropTarget;
    return mealNames.includes(target as Meal) ? (target as Meal) : null;
  }
  function startLogDrag(logId: string, event: PointerEventType<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    dragPointer.current = { logId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function continueLogDrag(event: PointerEventType<HTMLButtonElement>) {
    const drag = dragPointer.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    drag.moved = true;
    setDraggingLogId(drag.logId);
    setDropMeal(mealAtPoint(event.clientX, event.clientY));
  }
  function finishLogDrag(event: PointerEventType<HTMLButtonElement>) {
    const drag = dragPointer.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 8;
    const destination = moved ? mealAtPoint(event.clientX, event.clientY) : null;
    if (destination) onMove(drag.logId, destination);
    dragPointer.current = null;
    setDraggingLogId(null);
    setDropMeal(null);
  }
  function cancelLogDrag() {
    dragPointer.current = null;
    setDraggingLogId(null);
    setDropMeal(null);
  }
  function moveByKeyboard(logId: string, currentMeal: Meal, direction: -1 | 1) {
    const currentIndex = mealNames.indexOf(currentMeal);
    const nextIndex = (currentIndex + direction + mealNames.length) % mealNames.length;
    onMove(logId, mealNames[nextIndex]);
    requestAnimationFrame(() => document.getElementById(`drag-log-${logId}`)?.focus());
  }

  const recs = recipes
    .filter(recipe => !recipeMatchesAvoidance(recipe, foods, profile?.avoid ?? ''))
    .map(recipe => {
      const n = recipeNutrition(recipe, foods);
      const perServing = multiplyNutrients(n, 1 / recipe.servings);
      return {
        recipe,
        perServing,
        preferred: recipePreferenceScore(recipe, foods, profile?.preferences ?? '') > 0,
        fits: recipeFit(perServing, remaining),
      };
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || Number(b.fits) - Number(a.fits))
    .slice(0, 2);

  const friendlyDate = new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{friendlyDate}</div>
          <h1 className="page-title">{name.trim() ? t.today.helloNamed(name.trim()) : t.today.helloGeneric}</h1>
          <p className="page-subtitle">{t.today.subtitle}</p>
        </div>
        <button className="button" onClick={() => onAdd(undefined, 'Desayuno')} data-testid="button-add-today">
          <Plus size={17} /> {t.today.addLog}
        </button>
      </div>
      <WeekCalendar date={date} setDate={setDate} loggedDates={loggedDates} />
      {reminder.enabled && reminder.times.includes(clockMinute) && (
        <div className="card panel" style={{ marginBottom: 18, background: '#edf3e9' }}>
          <b>{t.today.reminderTitle}</b>
          <p className="small-text muted" style={{ marginBottom: 0 }}>
            {t.today.reminderBody}
          </p>
        </div>
      )}
      <div className="grid two-col">
        <section className="card panel" style={{ background: 'linear-gradient(145deg,#eff3e8,#faf8f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow">{t.today.energyLogged}</div>
              <div className="today-energy-stat">
                <span className="stat-value">{fmt(total.kcal)}</span>
                <span className="muted"> / {fmt(goal.calories)} kcal</span>
              </div>
            </div>
            <div className="today-energy-icon">
              <Activity size={21} />
            </div>
          </div>
          <div className="progress-track today-progress">
            <div className="progress-fill" style={{ width: `${Math.min(100, (total.kcal / goal.calories) * 100)}%` }} />
          </div>
          <div className="small-text muted">{remaining.kcal >= 0 ? t.today.remainingKcal(fmt(remaining.kcal)) : t.today.overKcal(fmt(Math.abs(remaining.kcal)))}</div>
          <div className="divider today-divider" />
          <div className="eyebrow">{t.today.macros}</div>
          <MacroMeter name={t.today.protein} value={total.protein} target={goal.protein} color="#69997a" />
          <MacroMeter name={t.today.carbs} value={total.carbs} target={goal.carbs} color="#d5a85e" />
          <MacroMeter name={t.today.fat} value={total.fat} target={goal.fat} color="#d78068" />
        </section>
        <section className="card panel">
          <div className="meal-card-head">
            <div>
              <div className="eyebrow">{t.today.yourDay}</div>
              <h2 className="serif meal-card-title">{t.today.mealLogTitle}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasYesterdayLogs && (
                <button type="button" className="button secondary small" onClick={onCopyYesterday} data-testid="button-copy-yesterday">
                  <Copy size={14} /> {isEn ? 'Copy yesterday' : 'Copiar ayer'}
                </button>
              )}
              <div className="date-control">
                <input aria-label={isEn ? 'Pick date' : 'Elegir fecha'} className="input desktop-date" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-log-date" />
                <label className="mobile-date" aria-label={isEn ? 'Pick date' : 'Elegir fecha'}>
                  <CalendarDays size={18} />
                  <input aria-label={isEn ? 'Pick date' : 'Elegir fecha'} type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-log-date-mobile" />
                </label>
              </div>
            </div>
          </div>
          {mealNames.map(meal => {
            const list = logs.filter(l => l.meal === meal);
            return (
              <div className={`meal-block${dropMeal === meal ? ' drop-target' : ''}`} key={meal} data-meal-drop-target={meal}>
                <div className="meal-head">
                  <div className="meal-title">{labelMeal(meal, lang)}</div>
                  <button className="icon-button" aria-label={`${t.today.addBtn} ${labelMeal(meal, lang)}`} onClick={() => onAdd(undefined, meal)} data-testid={`button-add-meal-${meal.toLowerCase()}`}>
                    <Plus size={18} />
                  </button>
                </div>
                {list.length > 0
                  ? list.map(l => {
                      const entryName = foodDisplayName(l.foodId, l.name, lang);
                      return (
                        <div className={`food-row${draggingLogId === l.id ? ' is-dragging' : ''}`} key={l.id}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <b style={{ fontSize: 13 }}>{entryName}</b>
                            <div className="small-text muted">
                              {l.grams ? `${fmt(l.grams)} g` : `${fmt(l.amount)} ${l.unit === 'ud' ? t.today.servingsUnit : 'g'}`} · {fmt(l.nutrients.kcal)} kcal{' '}
                              {l.demo && (
                                <span className="pill demo-pill" style={{ marginLeft: 5 }}>
                                  {t.today.demoTag}
                                </span>
                              )}
                            </div>
                            <NutrientSummary nutrients={l.nutrients} label={entryName} />
                          </div>
                          <div className="food-row-actions">
                            <button
                              type="button"
                              id={`drag-log-${l.id}`}
                              className="log-drag-handle"
                              aria-label={`${isEn ? 'Move' : 'Mover'} ${entryName}`}
                              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                              onPointerDown={event => startLogDrag(l.id, event)}
                              onPointerMove={continueLogDrag}
                              onPointerUp={finishLogDrag}
                              onPointerCancel={cancelLogDrag}
                              onKeyDown={event => {
                                if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                                  event.preventDefault();
                                  moveByKeyboard(l.id, l.meal, -1);
                                } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                                  event.preventDefault();
                                  moveByKeyboard(l.id, l.meal, 1);
                                }
                              }}
                              data-testid={`button-drag-log-${l.id}`}
                            >
                              <GripVertical size={18} />
                            </button>
                            <button className="icon-button" aria-label={`${isEn ? 'Delete' : 'Eliminar'} ${entryName}`} onClick={() => onDelete(l.id)} data-testid={`button-delete-log-${l.id}`}>
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
          {!logs.length && (
            <p className="small-text muted" style={{ marginTop: 13 }}>
              {t.today.emptyLog}
            </p>
          )}
        </section>
      </div>
      <div className="grid two-col" style={{ marginTop: 18 }}>
        <section className="card panel">
          <div className="eyebrow">{t.today.ideaForToday}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 className="serif" style={{ fontSize: 26, margin: '6px 0 12px' }}>
              {t.today.couldFit}
            </h2>
            <button className="button ghost small" onClick={() => onNavigate('/recipes')} data-testid="button-see-recipes">
              {t.today.seeRecipes} <ChevronRight size={14} />
            </button>
          </div>
          {recs.length ? (
            recs.map(({ recipe, perServing, preferred, fits }) => {
              const rDisp = recipeDisplay(recipe, lang);
              return (
                <article className="today-recipe-card" key={recipe.id} data-testid={`card-today-recipe-${recipe.id}`}>
                  <div className="today-recipe-heading">
                    <div className="today-recipe-copy">
                      <b>{rDisp.name}</b>
                      <span className="small-text muted">
                        {recipe.minutes} min{preferred ? ` · ${t.today.matchesPrefs}` : ''}
                      </span>
                    </div>
                    <div className="today-recipe-actions">
                      <span className="pill">{fits ? t.today.canFit : t.today.freeChoice}</span>
                      <button type="button" className="button secondary small" aria-label={`${t.today.addBtn} ${rDisp.name}`} onClick={() => onRecipe(recipe)} data-testid={`button-log-suggested-recipe-${recipe.id}`}>
                        {t.today.addBtn}
                      </button>
                    </div>
                  </div>
                  <NutrientSummary nutrients={perServing} label={rDisp.name} />
                </article>
              );
            })
          ) : (
            <Empty title={t.today.noExactSuggestions} text={t.today.noExactSuggestionsText} />
          )}
          <p className="small-text muted">{t.today.compatibilityNote}</p>
        </section>
        <section className="card panel">
          <div className="eyebrow">{t.today.yourDishes}</div>
          <h2 className="serif" style={{ fontSize: 26, margin: '6px 0 12px' }}>
            {t.today.madeByYou}
          </h2>
          {dishes.length ? (
            dishes.slice(0, 3).map(d => (
              <article className="today-recipe-card" key={d.id}>
                <div className="today-recipe-heading">
                  <div className="today-recipe-copy">
                    <b>{d.name}</b>
                    <span className="small-text muted">{t.today.yourDishPerServing}</span>
                  </div>
                  <button className="button secondary small" onClick={() => onDish(d)} data-testid={`button-log-personal-dish-${d.id}`}>
                    {t.today.addBtn}
                  </button>
                </div>
                <NutrientSummary nutrients={calculateDishNutrients(d, foods)} label={d.name} />
              </article>
            ))
          ) : (
            <>
              <Empty title={t.today.collectionStartsHere} text={t.today.collectionStartsText} />
              <button className="button secondary small" style={{ marginTop: 12 }} onClick={() => onNavigate('/foods')} data-testid="button-create-first-dish">
                {t.today.createFirstDish}
              </button>
            </>
          )}
        </section>
      </div>
      <div className="small-text muted" style={{ textAlign: 'center', marginTop: 24 }}>
        {t.today.disclaimer}
      </div>
    </>
  );
}