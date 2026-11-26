import { useEffect, useMemo, useState } from 'react';
import { Clock3, Heart, Plus } from 'lucide-react';
import { foodById, recipeFit, recipeNutrition, type Food, type Nutrients, type Profile, type Recipe } from '../lib/domain';
import { foodDisplayName, getLocale, recipeDisplay, translations as i18n, useLang } from '../lib/i18n';
import { Empty, Field } from './AppPrimitives';
import NutrientSummary from './NutrientSummary';

const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');

export default function RecipeSection({
  recipes,
  foods,
  remaining,
  favorites,
  recipeFavorites,
  onToggleFavorite,
  profile,
  filters,
  setFilters,
  onAdd,
}: {
  recipes: Recipe[];
  foods: Food[];
  remaining: Nutrients;
  favorites: string[];
  recipeFavorites: string[];
  onToggleFavorite: (id: string) => void;
  profile: Profile | null;
  filters: { favorites: boolean; available: boolean; fit: boolean; maxTime: string; budget: string };
  setFilters: (v: { favorites: boolean; available: boolean; fit: boolean; maxTime: string; budget: string }) => void;
  onAdd: (r: Recipe) => void;
}) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = i18n[lang];
  const locale = getLocale(lang);

  const normalizeFoodName = (food: Food) =>
    foodDisplayName(food.id, food.name, lang).trim().toLocaleLowerCase(locale);

  const [availableNames, setAvailableNames] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [excludedNames, setExcludedNames] = useState<string[]>([]);

  useEffect(() => {
    setAvailableNames([]);
    setExcludedNames([]);
  }, [lang]);

  const recipeFoods = useMemo(() => {
    const usedIds = new Set(recipes.flatMap(r => r.ingredients.map(i => i.foodId)));
    const byName = new Map<string, { key: string; label: string }>();

    foods
      .filter(f => usedIds.has(f.id))
      .forEach(f => {
        const label = foodDisplayName(f.id, f.name, lang).trim();
        const key = label.toLocaleLowerCase(locale);
        if (!byName.has(key)) {
          byName.set(key, { key, label });
        }
      });

    return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [recipes, foods, lang, locale]);

  const favoriteFoods = foods.filter(f => favorites.includes(f.id));
  const favoriteFoodNames = new Set(favoriteFoods.map(normalizeFoodName));
  const avoidedNames = (profile?.avoid ?? '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  const list = recipes
    .filter(r => !filters.favorites || recipeFavorites.includes(r.id))
    .filter(
      r =>
        !filters.available ||
        r.ingredients.every(i => {
          const food = foodById(i.foodId, foods);
          return food ? favoriteFoodNames.has(normalizeFoodName(food)) : false;
        })
    )
    .filter(
      r =>
        !availableOnly ||
        r.ingredients.every(i => {
          const food = foodById(i.foodId, foods);
          return food ? availableNames.includes(normalizeFoodName(food)) : false;
        })
    )
    .filter(r =>
      r.ingredients.every(i => {
        const food = foodById(i.foodId, foods);
        return food ? !excludedNames.includes(normalizeFoodName(food)) : true;
      })
    )
    .filter(r => !r.ingredients.some(i => avoidedNames.some(name => foodById(i.foodId, foods)?.name.toLowerCase().includes(name))))
    .filter(r => !filters.maxTime || r.minutes <= Number(filters.maxTime))
    .filter(r => !filters.budget || (r.cost !== undefined && r.cost <= Number(filters.budget)))
    .filter(
      r =>
        !filters.fit ||
        recipeFit(
          {
            ...recipeNutrition(r, foods),
            kcal: recipeNutrition(r, foods).kcal / r.servings,
            protein: recipeNutrition(r, foods).protein / r.servings,
            carbs: recipeNutrition(r, foods).carbs / r.servings,
            fat: recipeNutrition(r, foods).fat / r.servings,
          },
          remaining
        )
    );

  const toggle = (key: 'favorites' | 'available' | 'fit') => setFilters({ ...filters, [key]: !filters[key] });

  return (
    <>
      <section className="card panel">
        <div className="eyebrow">{t.recipes.refineEyebrow}</div>
        <div className="tab-row">
          <button type="button" className={`tab ${filters.favorites ? 'selected' : ''}`} onClick={() => toggle('favorites')} data-testid="toggle-recipe-favorites">
            {t.recipes.favRecipes}
          </button>
          <button type="button" className={`tab ${filters.available ? 'selected' : ''}`} onClick={() => toggle('available')} data-testid="toggle-recipe-available">
            {t.recipes.favFoodsBased}
          </button>
          <button type="button" className={`tab ${availableOnly ? 'selected' : ''}`} onClick={() => setAvailableOnly(!availableOnly)} data-testid="toggle-recipe-available-in-pantry">
            {t.recipes.onlyPantry}
          </button>
          <button type="button" className={`tab ${filters.fit ? 'selected' : ''}`} onClick={() => toggle('fit')} data-testid="toggle-recipe-fit">
            {t.recipes.fitsMacros}
          </button>
        </div>
        {availableOnly && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{t.recipes.markAvailable}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {recipeFoods.map(item => (
                <button
                  type="button"
                  className={`tab ${availableNames.includes(item.key) ? 'selected' : ''}`}
                  key={item.key}
                  onClick={() => setAvailableNames(availableNames.includes(item.key) ? availableNames.filter(x => x !== item.key) : [...availableNames, item.key])}
                  data-testid={`toggle-pantry-food-${item.key}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field-row">
          <Field label={t.recipes.maxTime} test="input-recipe-time">
            <input className="input" type="number" min="1" placeholder={t.recipes.noLimit} value={filters.maxTime} onChange={e => setFilters({ ...filters, maxTime: e.target.value })} />
          </Field>
          <Field label={t.recipes.maxBudget} test="input-recipe-budget">
            <input className="input" type="number" min="0" step=".5" placeholder={profile?.budget ? `${isEn ? 'Your ref' : 'Tu referencia'}: €${profile.budget}` : t.recipes.noLimit} value={filters.budget} onChange={e => setFilters({ ...filters, budget: e.target.value })} />
          </Field>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>{t.recipes.excludeFoods}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {recipeFoods.map(item => (
              <button
                type="button"
                className={`tab ${excludedNames.includes(item.key) ? 'selected' : ''}`}
                key={item.key}
                onClick={() => setExcludedNames(excludedNames.includes(item.key) ? excludedNames.filter(x => x !== item.key) : [...excludedNames, item.key])}
                data-testid={`toggle-exclude-food-${item.key}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="small-text muted">
          {isEn
            ? 'Favorite foods come from what you starred in Foods; pantry availability is an independent selection. Items in your profile avoid list are excluded automatically.'
            : 'El filtro de alimentos favoritos usa lo marcado en Alimentos; disponibilidad es una selección independiente. Los ingredientes de tu lista de “evitar” también se excluyen.'}
        </p>
      </section>
      <div className="grid three-col recipe-grid" style={{ marginTop: 18 }}>
        {list.map(r => {
          const n = recipeNutrition(r, foods);
          const each = { kcal: n.kcal / r.servings, protein: n.protein / r.servings, carbs: n.carbs / r.servings, fat: n.fat / r.servings };
          const fits = recipeFit(each, remaining);
          const rDisp = recipeDisplay(r, lang);
          return (
            <article className="card recipe-card" key={r.id} data-testid={`card-recipe-${r.id}`}>
              <div className="recipe-card-meta">
                <div className="eyebrow">{rDisp.tags.join(' · ')}</div>
                <span className={`pill ${r.demo ? 'demo-pill' : ''}`}>{r.demo ? (isEn ? 'Sample reference' : 'Ejemplo orientativo') : isEn ? 'Calculated with BEDCA' : 'Calculado con BEDCA'}</span>
              </div>
              <h2 className="serif recipe-card-title">{rDisp.name}</h2>
              <p className="small-text muted recipe-card-description">{rDisp.description}</p>
              <NutrientSummary nutrients={each} label={rDisp.name} />
              <div className="small-text muted recipe-card-time">
                <Clock3 size={13} style={{ verticalAlign: '-2px' }} /> {r.minutes} min{r.cost !== undefined ? ` · €${r.cost.toFixed(2)} ${isEn ? 'approx.' : 'aprox.'}` : ''} · {r.servings}{' '}
                {r.servings === 1 ? (isEn ? 'serving' : 'ración') : isEn ? 'servings' : 'raciones'}
              </div>
              <div className="small-text muted recipe-card-ingredients">
                {isEn ? 'Ingredients' : 'Ingredientes'}: {r.ingredients.map(i => `${foodDisplayName(i.foodId, foodById(i.foodId, foods)?.name ?? (isEn ? 'Food' : 'Alimento'), lang)} (${fmt(i.grams)} g)`).join(', ')}.
              </div>
              <div className="recipe-card-footer">
                <button className="icon-button" onClick={() => onToggleFavorite(r.id)} aria-label={isEn ? 'Favorite recipe' : 'Guardar receta favorita'} data-testid={`button-favorite-recipe-${r.id}`}>
                  <Heart size={17} fill={recipeFavorites.includes(r.id) ? '#729574' : 'none'} />
                </button>
                <span className="pill">{fits ? t.today.canFit : isEn ? 'Explore freely' : 'Explorar libremente'}</span>
                <button className="button secondary small" onClick={() => onAdd(r)} data-testid={`button-add-recipe-${r.id}`}>
                  <Plus size={14} /> {t.recipes.logBtn}
                </button>
              </div>
            </article>
          );
        })}
        {!list.length && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Empty title={t.recipes.noRecipesTitle} text={t.recipes.noRecipesText} />
          </div>
        )}
      </div>
    </>
  );
}