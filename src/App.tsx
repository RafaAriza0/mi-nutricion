import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import type { Session } from '@supabase/supabase-js';
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, BookOpen, Check, ChevronRight, Leaf, LogOut, Plus, Search, Settings2, Trash2, Utensils, X } from 'lucide-react';
import { addNutrients, blankProfile, demoFoods, demoRecipes, foodById, foodCategories, foodMatchesCategory, id, moveLogEntry, multiplyNutrients, nutrientsPerServing, recipeFit, recipeMatchesAvoidance, recipeNutrition, recipePreferenceScore, scaled, shiftDate, sumLogs, targets, today, weekLoggedDateKeys, type Dish, type Food, type FoodCategory, type LogEntry, type Meal, type Nutrients, type Profile, type Store, type WeightEntry } from './lib/domain';
import { bedcaFoods, bedcaRecipes } from './lib/bedca-catalog';
import { lookupOpenFoodFactsProduct, type OpenFoodFactsProduct } from './lib/openfoodfacts';
import { clearPersonalStore, loadCloudStore, loadStore, saveCloudStore, saveStore } from './lib/storage';
import { supabase } from './lib/supabase';
import { foodDisplayName, getLocale, labelCategory, labelMeal, recipeDisplay, translations as i18n, useLang } from './lib/i18n';
import AuthGate from './components/AuthGate';
import ProfileOnboarding from './components/ProfileOnboarding';
import MealEntryPicker, { type MealEntryOption } from './components/MealEntryPicker';
import NutrientSummary from './components/NutrientSummary';
import { Empty, Field } from './components/AppPrimitives';
import TodayPage from './components/TodayPage';
import FoodRow from './components/FoodRow';
import RecipeSection from './components/RecipeSection';
import Stats from './components/Stats';
import './index.css';

const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');
const emptyN: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const allRecipes = [...bedcaRecipes, ...demoRecipes];

function calculateDishNutrients(dish: Dish, foods: Food[]): Nutrients {
  const total = dish.ingredients.reduce((nutrients, ingredient) => {
    const food = foodById(ingredient.foodId, foods);
    return food ? addNutrients(nutrients, scaled(food, ingredient.grams)) : nutrients;
  }, emptyN);
  return multiplyNutrients(total, 1 / dish.servings);
}

function App() {
  const [lang, setLang] = useLang();
  const isEn = lang === 'en';
  const t = i18n[lang];
  const locale = getLocale(lang);

  const navItems = useMemo(
    () => [
      { href: '/', label: t.nav.today, icon: Leaf },
      { href: '/foods', label: t.nav.foods, icon: Utensils },
      { href: '/recipes', label: t.nav.recipes, icon: BookOpen },
      { href: '/stats', label: t.nav.stats, icon: BarChart3 },
      { href: '/profile', label: t.nav.profile, icon: Settings2 },
    ],
    [t]
  );

  const [store, setStore] = useState<Store>(() => loadStore());
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [path, setPath] = useLocation();
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'food' | 'dish' | 'log' | 'weight' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal>('Desayuno');
  const [logTab, setLogTab] = useState<'food' | 'dish' | 'recipe' | 'history'>('food');
  const [logSelection, setLogSelection] = useState('');
  const [dishReturnToLog, setDishReturnToLog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today());
  const [filter, setFilter] = useState('Todos');
  const [foodCategory, setFoodCategory] = useState<FoodCategory | 'Todas'>('Todas');
  const [search, setSearch] = useState('');
  const [recipeFilters, setRecipeFilters] = useState({ favorites: false, available: false, fit: false, maxTime: '', budget: '' });
  const [profileForm, setProfileForm] = useState<Profile>(store.profile ?? blankProfile);
  const [reminderDraft, setReminderDraft] = useState(store.reminder);
  const [weekMode, setWeekMode] = useState<'Semana' | 'Mes'>('Semana');
  const [clockMinute, setClockMinute] = useState(() => new Date().toTimeString().slice(0, 5));
  const [weightDraft, setWeightDraft] = useState({ date: today(), weight: '', note: '' });
  const [foodDraft, setFoodDraft] = useState({ name: '', unit: 'g', gramsPerUnit: '100', kcal: '', protein: '', carbs: '', fat: '', barcode: '', source: 'Dato personal' });
  const [offBarcode, setOffBarcode] = useState('');
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState('');
  const [offProduct, setOffProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [offReviewPending, setOffReviewPending] = useState(false);
  const [offLabelConfirmed, setOffLabelConfirmed] = useState(false);
  const [dishDraft, setDishDraft] = useState<Dish>({ id: '', name: '', description: '', ingredients: [], servings: 1, notes: '', tags: [], cost: undefined });
  const [ingredientPick, setIngredientPick] = useState('');
  const [ingredientCategory, setIngredientCategory] = useState<FoodCategory | 'Todas'>('Todas');
  const [ingredientGrams, setIngredientGrams] = useState('100');
  const [photoError, setPhotoError] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const allFoods = useMemo(() => [...bedcaFoods, ...demoFoods, ...store.foods], [store.foods]);
  const visibleFoods = useMemo(
    () =>
      allFoods
        .filter(f => foodDisplayName(f.id, f.name, lang).toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)))
        .filter(f => foodMatchesCategory(f, foodCategory))
        .filter(
          f =>
            filter === 'Todos' ||
            (filter === 'Favoritos' && store.favorites.includes(f.id)) ||
            (filter === 'Recientes' && store.recent.includes(f.id)) ||
            (filter === 'Mis alimentos' && !f.demo && !f.catalog) ||
            (filter === 'BEDCA' && f.catalog) ||
            (filter === 'Ejemplos' && f.demo)
        ),
    [allFoods, search, lang, locale, filter, foodCategory, store.favorites, store.recent]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCloudReady(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    setCloudReady(false);
    loadCloudStore(session.user.id)
      .then(cloudStore => {
        if (cancelled) return;
        setStore(cloudStore);
        setProfileForm(cloudStore.profile ?? blankProfile);
        setReminderDraft(cloudStore.reminder);
        setCloudReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setCloudReady(true);
          setToast(
            isEn
              ? 'Could not load cloud data; using local copy.'
              : 'No se pudieron cargar los datos de la nube; usando copia local.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const result = saveStore(store);
    if (!result.ok) {
      setToast(result.message ?? (isEn ? 'Could not save' : 'No se pudo guardar'));
    }
    if (!session?.user || !cloudReady) return;
    const timer = setTimeout(() => {
      void saveCloudStore(session.user.id, store).then(res => {
        if (!res.ok && res.message) setToast(res.message);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [store, session?.user, cloudReady, isEn]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = setInterval(() => setClockMinute(new Date().toTimeString().slice(0, 5)), 30000);
    return () => clearInterval(timer);
  }, []);

  const notify = (message: string) => setToast(message);
  const update = (fn: (s: Store) => Store) => setStore(old => fn(old));

  const profile = store.profile;
  const goal = targets(profile);
  const needsProfileSetup = !profile || !profile.name.trim();
  const todayLogs = store.logs.filter(l => l.date === selectedDate);
  const yesterdayDate = shiftDate(selectedDate, -1);
  const yesterdayLogs = store.logs.filter(l => l.date === yesterdayDate);
  const total = sumLogs(todayLogs);
  const calendarLoggedDates = useMemo(() => weekLoggedDateKeys(store.logs, selectedDate), [store.logs, selectedDate]);
  const remaining = {
    kcal: goal.calories - total.kcal,
    protein: goal.protein - total.protein,
    carbs: goal.carbs - total.carbs,
    fat: goal.fat - total.fat,
  };

  function dishStats(d: Dish) {
    return calculateDishNutrients(d, allFoods);
  }

  const logOptions = useMemo<MealEntryOption[]>(() => {
    const unitEnMap: Record<string, string> = {
      unidad: 'unit',
      rebanada: 'slice',
      ración: 'serving',
      cucharadita: 'teaspoon',
    };
    const foodOptions: MealEntryOption[] = allFoods.map(food => ({
      key: `food:${food.id}`,
      id: food.id,
      kind: 'food',
      name: foodDisplayName(food.id, food.name, lang),
      source: food.catalog
        ? 'BEDCA'
        : food.demo
        ? isEn
          ? 'Sample reference'
          : 'Ejemplo orientativo'
        : isEn
        ? 'Personal food'
        : 'Alimento personal',
      nutrients: food,
      gramsPerUnit: food.gramsPerUnit,
      unit: isEn && food.unit !== 'g' ? (unitEnMap[food.unit] ?? food.unit) : food.unit,
      demo: food.demo,
    }));
    const dishOptions: MealEntryOption[] = store.dishes.map(dish => ({
      key: `dish:${dish.id}`,
      id: dish.id,
      kind: 'dish',
      name: dish.name,
      source: isEn ? 'Personal dish' : 'Plato personal',
      nutrients: dishStats(dish),
      tags: dish.tags,
    }));
    const recipeOptions: MealEntryOption[] = allRecipes
      .filter(recipe => !recipeMatchesAvoidance(recipe, allFoods, profile?.avoid ?? ''))
      .map(recipe => {
        const totalNutrition = recipeNutrition(recipe, allFoods);
        const nutrients = multiplyNutrients(totalNutrition, 1 / recipe.servings);
        const preferred = recipePreferenceScore(recipe, allFoods, profile?.preferences ?? '') > 0;
        const fits = recipeFit(nutrients, remaining);
        const prefLabel = preferred
          ? isEn
            ? 'Matches preferences'
            : 'Afín a tus preferencias'
          : isEn
          ? 'To explore'
          : 'Para explorar';
        const fitLabel = fits
          ? isEn
            ? 'Fits your macros'
            : 'Puede encajar en tus macros'
          : isEn
          ? 'Free choice'
          : 'Elección libre';
        const rDisp = recipeDisplay(recipe, lang);
        return {
          key: `recipe:${recipe.id}`,
          id: recipe.id,
          kind: 'recipe' as const,
          name: rDisp.name,
          source: recipe.demo
            ? isEn
              ? 'Suggested recipe · sample'
              : 'Receta sugerida · ejemplo orientativo'
            : isEn
            ? 'Suggested recipe · BEDCA'
            : 'Receta sugerida · BEDCA',
          nutrients,
          tags: rDisp.tags,
          compatibility: `${prefLabel} · ${fitLabel}`,
          demo: recipe.demo,
        };
      })
      .sort((a, b) => Number(b.compatibility?.includes('Matches') || b.compatibility?.includes('Afín')) - Number(a.compatibility?.includes('Matches') || a.compatibility?.includes('Afín')));
    const latestHistory = new Map<string, LogEntry>();
    store.logs.forEach(entry => {
      if ((entry.foodId.startsWith('dish:') || entry.foodId.startsWith('recipe:')) && !latestHistory.has(entry.foodId)) {
        latestHistory.set(entry.foodId, entry);
      }
    });
    const historyOptions: MealEntryOption[] = [...latestHistory.values()].map(entry => ({
      key: `history:${entry.id}`,
      id: entry.foodId,
      kind: 'history',
      name: foodDisplayName(entry.foodId, entry.name, lang),
      source: entry.foodId.startsWith('dish:')
        ? isEn
          ? 'Dish from history'
          : 'Plato del historial'
        : isEn
        ? 'Recipe from history'
        : 'Receta del historial',
      nutrients: nutrientsPerServing(entry),
    }));
    return [...foodOptions, ...dishOptions, ...recipeOptions, ...historyOptions];
  }, [allFoods, isEn, lang, profile?.avoid, profile?.preferences, remaining, store.dishes, store.logs]);

  function openFood(food?: Food) {
    setEditId(food?.id ?? null);
    setFoodDraft(
      food
        ? {
            name: food.name,
            unit: food.unit,
            gramsPerUnit: String(food.gramsPerUnit),
            kcal: String(food.kcal),
            protein: String(food.protein),
            carbs: String(food.carbs),
            fat: String(food.fat),
            barcode: food.barcode ?? '',
            source: food.source,
          }
        : {
            name: '',
            unit: 'g',
            gramsPerUnit: '100',
            kcal: '',
            protein: '',
            carbs: '',
            fat: '',
            barcode: '',
            source: isEn ? 'Personal entry' : 'Dato personal',
          }
    );
    const requiresLabelReview = Boolean(food?.source.startsWith('Open Food Facts'));
    setOffReviewPending(requiresLabelReview);
    setOffLabelConfirmed(false);
    setModal('food');
  }

  async function lookupOffProduct() {
    const barcode = offBarcode.trim();
    if (!/^\d{8,14}$/.test(barcode)) {
      setOffError(isEn ? 'Enter an 8 to 14 digit barcode.' : 'Introduce un código de barras de 8 a 14 cifras.');
      setOffProduct(null);
      return;
    }
    setOffLoading(true);
    setOffError('');
    setOffProduct(null);
    try {
      const product = await lookupOpenFoodFactsProduct(barcode);
      if (!product) {
        setOffError(
          isEn
            ? 'Barcode not found in Open Food Facts. Check the digits or create the food manually.'
            : 'No encontramos este código en Open Food Facts. Comprueba el número o crea el alimento manualmente.'
        );
        return;
      }
      setOffProduct(product);
    } catch (error) {
      setOffError(
        error instanceof Error
          ? error.message
          : isEn
          ? 'Could not query Open Food Facts.'
          : 'No se pudo consultar Open Food Facts.'
      );
    } finally {
      setOffLoading(false);
    }
  }

  function reviewOffProduct() {
    if (!offProduct) return;
    const existing = store.foods.find(f => f.barcode === offProduct.code);
    if (existing) {
      openFood(existing);
      return;
    }
    const productName = offProduct.name || offProduct.brands || (isEn ? 'Packaged product' : 'Producto envasado');
    const name =
      offProduct.brands && !productName.toLocaleLowerCase(locale).includes(offProduct.brands.toLocaleLowerCase(locale))
        ? `${productName} — ${offProduct.brands}`
        : productName;
    setEditId(null);
    setFoodDraft({
      name,
      unit: 'g',
      gramsPerUnit: '100',
      kcal: offProduct.kcal === null ? '' : String(offProduct.kcal),
      protein: offProduct.protein === null ? '' : String(offProduct.protein),
      carbs: offProduct.carbs === null ? '' : String(offProduct.carbs),
      fat: offProduct.fat === null ? '' : String(offProduct.fat),
      barcode: offProduct.code,
      source: 'Open Food Facts',
    });
    setOffReviewPending(true);
    setOffLabelConfirmed(false);
    setModal('food');
  }

  function saveFood() {
    if (offReviewPending && !offLabelConfirmed) {
      notify(
        isEn
          ? 'Confirm that you have checked the values against the package label.'
          : 'Confirma que has revisado los datos con la etiqueta del envase.'
      );
      return;
    }
    const values = [foodDraft.kcal, foodDraft.protein, foodDraft.carbs, foodDraft.fat].map(Number);
    if (
      !foodDraft.name.trim() ||
      [foodDraft.kcal, foodDraft.protein, foodDraft.carbs, foodDraft.fat].some(v => !v.trim()) ||
      values.some(v => !Number.isFinite(v) || v < 0) ||
      values[0] > 1000 ||
      values.slice(1).some(v => v > 100)
    ) {
      notify(
        isEn
          ? 'Fill in values per 100 g and ensure they are within a valid range.'
          : 'Completa los valores por 100 g y revisa que estén dentro de un rango válido.'
      );
      return;
    }
    const [kcal, protein, carbs, fat] = values;
    const base: Food = {
      id: editId ?? id(),
      name: foodDraft.name.trim(),
      unit: foodDraft.unit,
      gramsPerUnit: Number(foodDraft.gramsPerUnit) || 100,
      kcal,
      protein,
      carbs,
      fat,
      barcode: foodDraft.barcode.trim(),
      source: offReviewPending
        ? isEn
          ? 'Open Food Facts · label checked'
          : 'Open Food Facts · comprobado con etiqueta'
        : foodDraft.source.trim() || (isEn ? 'Personal entry' : 'Dato personal'),
      reviewed: today(),
    };
    update(s => ({ ...s, foods: editId ? s.foods.map(f => (f.id === editId ? base : f)) : [base, ...s.foods] }));
    setModal(null);
    setOffReviewPending(false);
    setOffLabelConfirmed(false);
    notify(editId ? (isEn ? 'Food updated.' : 'Alimento actualizado.') : isEn ? 'Food saved.' : 'Alimento guardado.');
  }

  function openLog(foodId?: string, meal?: Meal, tab: 'food' | 'dish' | 'recipe' | 'history' = 'food', selectionId?: string) {
    setSelectedMeal(meal ?? (tab === 'recipe' ? 'Comida' : 'Desayuno'));
    setLogTab(tab);
    setLogSelection(selectionId ?? foodId ?? '');
    setModal('log');
  }

  function confirmMealLog(option: MealEntryOption, amount: number, unit: 'g' | 'ud') {
    if (!Number.isFinite(amount) || amount <= 0) {
      notify(isEn ? 'Enter an amount greater than zero.' : 'Indica una cantidad mayor que cero.');
      return;
    }
    const date = selectedDate;
    const meal = selectedMeal;
    if (option.kind === 'food') {
      const food = foodById(option.id, allFoods);
      if (!food) {
        notify(isEn ? 'Food not found.' : 'No encontramos este alimento.');
        return;
      }
      const displayName = foodDisplayName(food.id, food.name, lang);
      const grams = unit === 'ud' ? amount * food.gramsPerUnit : amount;
      const nutrients = scaled(food, grams);
      update(s => {
        const existing = s.logs.find(l => l.foodId === food.id && l.meal === meal && l.date === date);
        const logs = existing
          ? s.logs.map(l =>
              l.id === existing.id
                ? { ...l, amount: l.amount + amount, grams: l.grams + grams, nutrients: addNutrients(l.nutrients, nutrients) }
                : l
            )
          : [{ id: id(), foodId: food.id, name: food.name, date, meal, amount, unit, grams, nutrients, demo: food.demo }, ...s.logs];
        return { ...s, logs, recent: [food.id, ...s.recent.filter(x => x !== food.id)].slice(0, 10) };
      });
      setModal(null);
      notify(
        isEn
          ? `${displayName} added to ${labelMeal(meal, lang).toLowerCase()}.`
          : `${displayName} añadido a ${meal.toLowerCase()}.`
      );
      return;
    }
    const foodId = option.kind === 'history' ? option.id : `${option.kind}:${option.id}`;
    const nutrients = multiplyNutrients(option.nutrients, amount);
    update(s => ({
      ...s,
      logs: [{ id: id(), foodId, name: option.name, date, meal, amount, unit: 'ud', grams: 0, nutrients, demo: option.demo }, ...s.logs],
    }));
    setModal(null);
    notify(
      isEn
        ? `${option.name} added to ${labelMeal(meal, lang).toLowerCase()}.`
        : `${option.name} añadido a ${meal.toLowerCase()}.`
    );
  }

  function copyYesterdayLogs() {
    if (!yesterdayLogs.length) {
      notify(isEn ? 'No entries from the previous day to copy.' : 'No hay registros del día anterior para copiar.');
      return;
    }
    const cloned: LogEntry[] = yesterdayLogs.map(entry => ({
      ...entry,
      id: id(),
      date: selectedDate,
    }));
    update(s => ({ ...s, logs: [...cloned, ...s.logs] }));
    notify(
      isEn
        ? `Copied ${cloned.length} entries from previous day.`
        : `Se copiaron ${cloned.length} registros del día anterior.`
    );
  }

  function deleteLog(logId: string) {
    const entry = store.logs.find(l => l.id === logId);
    if (!entry) return;
    const entryName = foodDisplayName(entry.foodId, entry.name, lang);
    const msg = isEn ? `Delete entry for ${entryName}?` : `¿Eliminar el registro de ${entryName}?`;
    if (!window.confirm(msg)) return;
    update(s => ({ ...s, logs: s.logs.filter(l => l.id !== logId) }));
    notify(isEn ? 'Entry deleted.' : 'Registro eliminado.');
  }

  function moveLog(logId: string, meal: Meal) {
    const entry = store.logs.find(l => l.id === logId);
    if (!entry || entry.meal === meal) return;
    const entryName = foodDisplayName(entry.foodId, entry.name, lang);
    update(s => ({ ...s, logs: moveLogEntry(s.logs, logId, meal) }));
    notify(
      isEn
        ? `${entryName} moved to ${labelMeal(meal, lang).toLowerCase()}.`
        : `${entryName} movido a ${meal.toLowerCase()}.`
    );
  }

  function favorite(foodId: string) {
    update(s => ({
      ...s,
      favorites: s.favorites.includes(foodId) ? s.favorites.filter(x => x !== foodId) : [...s.favorites, foodId],
    }));
  }

  function favoriteRecipe(recipeId: string) {
    update(s => ({
      ...s,
      recipeFavorites: s.recipeFavorites.includes(recipeId)
        ? s.recipeFavorites.filter(x => x !== recipeId)
        : [...s.recipeFavorites, recipeId],
    }));
  }

  function deleteFood(food: Food) {
    if (food.demo || food.catalog) return;
    const msg = isEn
      ? `Delete ${food.name}? Existing log entries will keep their data.`
      : `¿Eliminar ${food.name}? Los registros existentes conservarán sus datos.`;
    if (!window.confirm(msg)) return;
    update(s => ({
      ...s,
      foods: s.foods.filter(f => f.id !== food.id),
      favorites: s.favorites.filter(x => x !== food.id),
    }));
    notify(isEn ? 'Food deleted.' : 'Alimento eliminado.');
  }

  function openDish(dish?: Dish) {
    setDishReturnToLog(false);
    setEditId(dish?.id ?? null);
    setDishDraft(
      dish
        ? { ...dish, ingredients: [...dish.ingredients] }
        : { id: '', name: '', description: '', ingredients: [], servings: 1, notes: '', tags: [], cost: undefined }
    );
    setIngredientCategory('Todas');
    setIngredientPick('');
    setPhotoError('');
    setModal('dish');
  }

  function createDishFromLog() {
    setDishReturnToLog(true);
    setEditId(null);
    setDishDraft({ id: '', name: '', description: '', ingredients: [], servings: 1, notes: '', tags: [], cost: undefined });
    setIngredientCategory('Todas');
    setIngredientPick('');
    setPhotoError('');
    setLogTab('dish');
    setLogSelection('');
    setModal('dish');
  }

  function saveDish() {
    if (!dishDraft.name.trim()) {
      notify(isEn ? 'Give your dish a name.' : 'Ponle un nombre a tu plato.');
      return;
    }
    if (!dishDraft.ingredients.length) {
      notify(isEn ? 'Add at least one ingredient to calculate nutrition.' : 'Añade al menos un alimento para calcular el plato.');
      return;
    }
    const dish = { ...dishDraft, id: editId ?? id(), servings: Math.max(1, Number(dishDraft.servings) || 1) };
    const returnToLog = dishReturnToLog;
    update(s => ({ ...s, dishes: editId ? s.dishes.map(d => (d.id === editId ? dish : d)) : [dish, ...s.dishes] }));
    setDishReturnToLog(false);
    setLogTab('dish');
    setLogSelection('');
    setModal(returnToLog ? 'log' : null);
    notify(
      editId
        ? isEn
          ? 'Dish updated.'
          : 'Plato actualizado.'
        : returnToLog
        ? isEn
          ? 'Dish saved. Choose how many servings to add.'
          : 'Plato guardado. Elige cuántas raciones añadir.'
        : isEn
        ? 'Dish saved.'
        : 'Plato guardado.'
    );
  }

  function completeOnboarding(nextProfile: Profile) {
    const initialWeight: WeightEntry = {
      id: id(),
      date: today(),
      weight: nextProfile.weight,
      note: isEn ? 'Initial measurement' : 'Medición inicial',
    };
    update(s => ({ ...s, profile: nextProfile, weights: s.weights.length ? s.weights : [initialWeight] }));
    setProfileForm(nextProfile);
    setPath('/');
    notify(isEn ? 'Profile saved. Your daily targets are ready.' : 'Perfil guardado. Ya tienes tus objetivos diarios.');
  }

  function saveProfile() {
    if (!profileForm.name.trim()) {
      notify(isEn ? 'Enter the name you would like us to call you.' : 'Añade el nombre con el que quieres que te llamemos.');
      return;
    }
    if (
      profileForm.age < 18 ||
      profileForm.age > 100 ||
      profileForm.height < 100 ||
      profileForm.height > 250 ||
      profileForm.weight < 30 ||
      profileForm.weight > 350
    ) {
      notify(isEn ? 'Check age, height, and weight before saving.' : 'Revisa edad, altura y peso antes de guardar.');
      return;
    }
    update(s => ({
      ...s,
      profile: {
        ...profileForm,
        name: profileForm.name.trim(),
        age: Number(profileForm.age),
        height: Number(profileForm.height),
        weight: Number(profileForm.weight),
        manualCalories: profileForm.manualCalories ? Number(profileForm.manualCalories) : null,
        manualProtein: profileForm.manualProtein ? Number(profileForm.manualProtein) : null,
        manualCarbs: profileForm.manualCarbs ? Number(profileForm.manualCarbs) : null,
        manualFat: profileForm.manualFat ? Number(profileForm.manualFat) : null,
        budget: profileForm.budget ? Number(profileForm.budget) : null,
      },
    }));
    notify(isEn ? 'Profile and targets saved.' : 'Perfil y objetivos guardados.');
  }

  function saveReminder() {
    update(s => ({ ...s, reminder: reminderDraft }));
    notify(isEn ? 'Reminder preferences saved.' : 'Preferencias de recordatorio guardadas.');
  }

  function saveWeight() {
    if (!weightDraft.weight || Number(weightDraft.weight) <= 0) {
      notify(isEn ? 'Enter a valid weight.' : 'Añade un peso válido.');
      return;
    }
    const record: WeightEntry = { id: id(), date: weightDraft.date, weight: Number(weightDraft.weight), note: weightDraft.note };
    update(s => ({ ...s, weights: [...s.weights, record].sort((a, b) => a.date.localeCompare(b.date)) }));
    setWeightDraft({ date: today(), weight: '', note: '' });
    setModal(null);
    notify(isEn ? 'Weight saved.' : 'Peso guardado.');
  }

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile: store.profile,
            foods: store.foods,
            logs: store.logs,
            dishes: store.dishes,
            favorites: store.favorites,
            recipeFavorites: store.recipeFavorites,
            recent: store.recent,
            weights: store.weights,
            reminder: store.reminder,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mi-nutricion-datos.json';
    a.click();
    URL.revokeObjectURL(url);
    notify(isEn ? 'Data backup downloaded.' : 'Copia de tus datos descargada.');
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      notify(isEn ? 'Backup file exceeds 2 MB.' : 'El archivo de copia supera los 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<Store>;
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        const nextStore: Store = {
          profile: parsed.profile && typeof parsed.profile === 'object' ? { ...blankProfile, ...parsed.profile } : store.profile,
          foods: Array.isArray(parsed.foods) ? parsed.foods : store.foods,
          logs: Array.isArray(parsed.logs) ? parsed.logs : store.logs,
          dishes: Array.isArray(parsed.dishes) ? parsed.dishes : store.dishes,
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : store.favorites,
          recipeFavorites: Array.isArray(parsed.recipeFavorites) ? parsed.recipeFavorites : store.recipeFavorites,
          recent: Array.isArray(parsed.recent) ? parsed.recent : store.recent,
          weights: Array.isArray(parsed.weights) ? parsed.weights : store.weights,
          reminder:
            parsed.reminder && typeof parsed.reminder === 'object' && Array.isArray(parsed.reminder.times)
              ? parsed.reminder
              : store.reminder,
        };
        setStore(nextStore);
        if (nextStore.profile) setProfileForm(nextStore.profile);
        setReminderDraft(nextStore.reminder);
        notify(isEn ? 'Backup imported and synced.' : 'Copia de seguridad importada y sincronizada.');
      } catch {
        notify(isEn ? 'Invalid JSON backup file.' : 'El archivo JSON no tiene un formato válido.');
      }
    };
    reader.readAsText(file);
  }

  function removePersonalData() {
    const msg = isEn
      ? 'Delete all your personal data saved in your account and this browser? The BEDCA catalog and samples will remain.'
      : '¿Borrar todos tus datos personales guardados en tu cuenta y en este navegador? El catálogo BEDCA y los ejemplos se conservarán.';
    if (!window.confirm(msg)) return;
    if (!clearPersonalStore()) {
      notify(isEn ? 'Could not clear browser data.' : 'No se pudieron borrar los datos del navegador.');
      return;
    }
    const reminder = { enabled: false, times: ['09:00', '13:00', '20:00'] };
    setStore({ profile: null, foods: [], logs: [], dishes: [], favorites: [], recipeFavorites: [], recent: [], weights: [], reminder });
    setProfileForm(blankProfile);
    setReminderDraft(reminder);
    notify(isEn ? 'Your personal data has been deleted.' : 'Tus datos personales se han borrado.');
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      clearPersonalStore();
      const reminder = { enabled: false, times: ['09:00', '13:00', '20:00'] };
      setStore({
        profile: null,
        foods: [],
        logs: [],
        dishes: [],
        favorites: [],
        recipeFavorites: [],
        recent: [],
        weights: [],
        reminder,
      });
      setProfileForm(blankProfile);
      setReminderDraft(reminder);
      notify(isEn ? 'Signed out.' : 'Sesión cerrada.');
    }
  }

  if (authLoading || (session && !cloudReady)) {
    return (
      <div className="app-shell">
        <main className="page-wrap" style={{ paddingTop: 64, textAlign: 'center' }}>
          <p className="small-text muted">{t.loadingSpace}</p>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell">
        <AuthGate />
        {toast && (
          <div className="toast" role="status" data-testid="status-toast">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      {!needsProfileSetup && (
        <header className="topbar">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark">m</span>
            <span className="brand-word">{t.brand}</span>
          </Link>
          <nav className="nav" aria-label={isEn ? 'Main navigation' : 'Navegación principal'}>
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${path === item.href ? 'active' : ''}`}
                data-testid={`link-${item.href === '/' ? 'hoy' : item.href.slice(1)}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="button ghost small"
              onClick={() => setLang(isEn ? 'es' : 'en')}
              aria-label={isEn ? 'Cambiar a español' : 'Switch to English'}
              data-testid="button-toggle-lang"
            >
              {isEn ? 'ES' : 'EN'}
            </button>
            <span className="pill mobile-status">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#77a578' }} /> {t.synced}
            </span>
          </div>
        </header>
      )}
      {needsProfileSetup ? (
        <ProfileOnboarding initialProfile={profile} onComplete={completeOnboarding} />
      ) : (
        <Switch>
          <Route path="/">
            <main className="page-wrap">
              <TodayPage
                name={profile.name}
                profile={profile}
                date={selectedDate}
                setDate={setSelectedDate}
                loggedDates={calendarLoggedDates}
                total={total}
                remaining={remaining}
                goal={goal}
                logs={todayLogs}
                hasYesterdayLogs={yesterdayLogs.length > 0}
                onCopyYesterday={copyYesterdayLogs}
                foods={allFoods}
                dishes={store.dishes}
                recipes={allRecipes}
                reminder={store.reminder}
                clockMinute={clockMinute}
                onAdd={openLog}
                onDelete={deleteLog}
                onMove={moveLog}
                onDish={d => openLog(undefined, undefined, 'dish', d.id)}
                onRecipe={r => openLog(undefined, undefined, 'recipe', r.id)}
                onNavigate={setPath}
              />
            </main>
          </Route>
          <Route path="/foods">
            <main className="page-wrap">
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t.foods.eyebrow}</div>
                  <h1 className="page-title">{t.foods.title}</h1>
                  <p className="page-subtitle">{t.foods.subtitle}</p>
                </div>
                <button className="button" data-testid="button-create-food" onClick={() => openFood()}>
                  <Plus size={17} /> {t.foods.createFood}
                </button>
              </div>
              <section className="card panel" aria-labelledby="off-search-title" style={{ marginBottom: 18, borderColor: 'rgba(215,198,245,.3)' }}>
                <div className="eyebrow">{t.foods.packagedEyebrow}</div>
                <h2 id="off-search-title" className="serif" style={{ fontSize: 24, margin: '6px 0' }}>
                  {t.foods.offTitle}
                </h2>
                <p className="small-text muted">{t.foods.offDesc}</p>
                <div className="field-row" style={{ alignItems: 'end', marginTop: 12 }}>
                  <Field label={t.foods.barcodeLabel} test="input-off-barcode">
                    <input
                      className="input"
                      inputMode="numeric"
                      maxLength={14}
                      value={offBarcode}
                      onChange={e => {
                        setOffBarcode(e.target.value.replace(/\D/g, ''));
                        setOffProduct(null);
                        setOffError('');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void lookupOffProduct();
                      }}
                      placeholder={t.foods.barcodePlaceholder}
                    />
                  </Field>
                  <button className="button" style={{ width: '100%' }} onClick={() => void lookupOffProduct()} disabled={offLoading} data-testid="button-search-open-food-facts">
                    <Search size={16} />
                    {offLoading ? t.foods.searching : t.foods.searchProduct}
                  </button>
                </div>
                {offError && (
                  <p className="small-text" role="alert" style={{ marginBottom: 0, color: '#e8a9b5' }} data-testid="status-off-error">
                    {offError}
                  </p>
                )}
                {offProduct && (
                  <div className="card panel" style={{ marginTop: 14, background: 'var(--app-surface-raised)' }} data-testid="card-off-product">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <b>{offProduct.name || (isEn ? 'Unnamed product' : 'Producto sin nombre')}</b>
                        <div className="small-text muted">
                          {[offProduct.brands, offProduct.quantity, `${isEn ? 'Barcode' : 'Código'} ${offProduct.code}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <a href={`https://world.openfoodfacts.org/product/${encodeURIComponent(offProduct.code)}`} target="_blank" rel="noreferrer" className="small-text" data-testid="link-off-product">
                        {t.foods.viewSheet}
                      </a>
                    </div>
                    <p className="small-text muted" style={{ margin: '9px 0' }}>
                      {isEn ? 'Per 100 g' : 'Por 100 g'} · {offProduct.kcal === null ? 'kcal —' : `${offProduct.kcal.toFixed(1)} kcal`} · P {offProduct.protein === null ? '—' : `${offProduct.protein.toFixed(1)} g`} · C {offProduct.carbs === null ? '—' : `${offProduct.carbs.toFixed(1)} g`} · {isEn ? 'F' : 'G'} {offProduct.fat === null ? '—' : `${offProduct.fat.toFixed(1)} g`}
                    </p>
                    <button className="button secondary" style={{ width: '100%' }} onClick={reviewOffProduct} data-testid="button-review-off-product">
                      {t.foods.reviewBeforeSave}
                    </button>
                  </div>
                )}
                <p className="small-text muted" style={{ margin: '12px 0 0' }}>
                  {isEn ? (
                    <>
                      Open Food Facts: collaborative database under ODbL and contents under DbCL. Always verify the physical label; app confirmation does not guarantee accuracy. Do not use to check allergens or for medical decisions.{' '}
                      <a href="https://world.openfoodfacts.org/terms-of-use" target="_blank" rel="noreferrer">
                        Terms
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      Open Food Facts: base colaborativa bajo licencia ODbL y contenidos bajo DbCL. Verifica siempre el producto físico; la confirmación de la app no garantiza que los datos sean correctos. No lo uses para comprobar alérgenos ni para decisiones médicas.{' '}
                      <a href="https://world.openfoodfacts.org/terms-of-use" target="_blank" rel="noreferrer">
                        Condiciones
                      </a>
                      .
                    </>
                  )}
                </p>
              </section>
              <div className="card panel">
                <div className="field-row">
                  <div className="field" style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 13, top: 13, color: '#849187' }} />
                    <input className="input" style={{ paddingLeft: 38 }} placeholder={t.foods.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-food-search" />
                  </div>
                  <div className="field">
                    <label htmlFor="food-filter">{t.foods.showLabel}</label>
                    <select className="select" id="food-filter" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-food-filter">
                      <option value="Todos">{t.foods.filters.all}</option>
                      <option value="BEDCA">{t.foods.filters.bedca}</option>
                      <option value="Favoritos">{t.foods.filters.favorites}</option>
                      <option value="Recientes">{t.foods.filters.recent}</option>
                      <option value="Mis alimentos">{t.foods.filters.mine}</option>
                      <option value="Ejemplos">{t.foods.filters.examples}</option>
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 14, maxWidth: 360 }}>
                  <label htmlFor="food-category-filter">{t.foods.categoryLabel}</label>
                  <select className="select" id="food-category-filter" value={foodCategory} onChange={e => setFoodCategory(e.target.value as FoodCategory | 'Todas')} data-testid="select-food-category">
                    <option value="Todas">{labelCategory('Todas', lang)}</option>
                    {foodCategories.map(category => (
                      <option key={category} value={category}>
                        {labelCategory(category, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: 18 }}>
                  {visibleFoods.map(f => (
                    <FoodRow key={f.id} food={f} favorite={store.favorites.includes(f.id)} onFavorite={() => favorite(f.id)} onEdit={() => openFood(f)} onDelete={() => deleteFood(f)} onAdd={() => openLog(f.id)} />
                  ))}
                  {!visibleFoods.length && <Empty title={t.foods.notFoundTitle} text={t.foods.notFoundText} />}
                </div>
                <p className="small-text muted" style={{ marginTop: 18 }}>
                  {isEn ? (
                    <>
                      BEDCA/AESAN values per 100 g of edible portion. Energy converted from kJ to kcal; database may contain errors. Personal/non-commercial use under its{' '}
                      <a href="https://www.bedca.net/bdpub/UsoBD.pdf" target="_blank" rel="noreferrer">
                        terms
                      </a>
                      . Check labels and preparation states (raw, boiled, grilled).
                    </>
                  ) : (
                    <>
                      Valores BEDCA/AESAN por 100 g de parte comestible. La energía se convierte de kJ a kcal; la base advierte que puede contener errores. Uso personal/no comercial y atribución según sus{' '}
                      <a href="https://www.bedca.net/bdpub/UsoBD.pdf" target="_blank" rel="noreferrer">
                        condiciones
                      </a>
                      . Revisa etiquetas y estados del alimento (crudo, hervido o a la plancha).
                    </>
                  )}
                </p>
              </div>
              <section className="card panel" style={{ marginTop: 18 }}>
                <div className="eyebrow">{t.foods.dishesEyebrow}</div>
                <div className="heading-row" style={{ margin: '8px 0 12px' }}>
                  <div>
                    <h2 className="serif" style={{ fontSize: 27, margin: '0 0 5px' }}>
                      {t.foods.dishesTitle}
                    </h2>
                    <p className="small-text muted">{t.foods.dishesSubtitle}</p>
                  </div>
                  <button className="button secondary" onClick={() => openDish()} data-testid="button-create-dish">
                    <Plus size={16} /> {t.foods.createDish}
                  </button>
                </div>
                {store.dishes.length ? (
                  store.dishes.map(d => (
                    <div className="list-row" key={d.id}>
                      {d.photo && <img src={d.photo} alt={d.name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 12 }} data-testid={`img-dish-${d.id}`} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{d.name}</b>
                        <div className="small-text muted">
                          {d.servings} {t.foods.servings}
                        </div>
                        <NutrientSummary nutrients={dishStats(d)} label={`${isEn ? 'Nutrition per serving of' : 'Aporte por ración de'} ${d.name}`} />
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="icon-button" aria-label={`${isEn ? 'Add' : 'Añadir'} ${d.name}`} onClick={() => openLog(undefined, undefined, 'dish', d.id)} data-testid={`button-add-dish-${d.id}`}>
                          <Plus size={17} />
                        </button>
                        <button className="icon-button" aria-label={`${isEn ? 'Edit' : 'Editar'} ${d.name}`} onClick={() => openDish(d)} data-testid={`button-edit-dish-${d.id}`}>
                          <Settings2 size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${isEn ? 'Delete' : 'Eliminar'} ${d.name}`}
                          onClick={() => {
                            if (window.confirm(isEn ? `Delete ${d.name}?` : `¿Eliminar ${d.name}?`)) {
                              update(s => ({ ...s, dishes: s.dishes.filter(x => x.id !== d.id) }));
                              notify(isEn ? 'Dish deleted.' : 'Plato eliminado.');
                            }
                          }}
                          data-testid={`button-delete-dish-${d.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty title={t.foods.noDishesTitle} text={t.foods.noDishesText} />
                )}
              </section>
            </main>
          </Route>
          <Route path="/recipes">
            <main className="page-wrap">
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t.recipes.eyebrow}</div>
                  <h1 className="page-title">{t.recipes.title}</h1>
                  <p className="page-subtitle">{t.recipes.subtitle}</p>
                </div>
                <Link href="/foods" className="button secondary" data-testid="link-recipes-foods">
                  {t.recipes.viewFoods} <ChevronRight size={16} />
                </Link>
              </div>
              <RecipeSection recipes={allRecipes} foods={allFoods} remaining={remaining} favorites={store.favorites} recipeFavorites={store.recipeFavorites} onToggleFavorite={favoriteRecipe} profile={profile} filters={recipeFilters} setFilters={setRecipeFilters} onAdd={r => openLog(undefined, undefined, 'recipe', r.id)} />
            </main>
          </Route>
          <Route path="/stats">
            <main className="page-wrap">
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t.stats.eyebrow}</div>
                  <h1 className="page-title">{t.stats.title}</h1>
                  <p className="page-subtitle">{t.stats.subtitle}</p>
                </div>
                <button className="button secondary" onClick={() => setModal('weight')} data-testid="button-add-weight">
                  <Plus size={16} /> {t.stats.logWeight}
                </button>
              </div>
              <div className="tab-row">
                <button className={`tab ${weekMode === 'Semana' ? 'selected' : ''}`} onClick={() => setWeekMode('Semana')} data-testid="tab-stats-week">
                  {t.stats.last7Days}
                </button>
                <button className={`tab ${weekMode === 'Mes' ? 'selected' : ''}`} onClick={() => setWeekMode('Mes')} data-testid="tab-stats-month">
                  {t.stats.last30Days}
                </button>
              </div>
              <Stats store={store} mode={weekMode} goal={goal} onRemoveWeight={weightId => update(s => ({ ...s, weights: s.weights.filter(w => w.id !== weightId) }))} />
            </main>
          </Route>
          <Route path="/profile">
            <main className="page-wrap">
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t.profile.eyebrow}</div>
                  <h1 className="page-title">{t.profile.title}</h1>
                  <p className="page-subtitle">{t.profile.subtitle}</p>
                </div>
              </div>
              <div className="grid two-col">
                <section className="card panel">
                  <h2 className="serif" style={{ fontSize: 27, margin: '0 0 6px' }}>
                    {t.profile.estimateTitle}
                  </h2>
                  <p className="small-text muted">{t.profile.estimateDesc}</p>
                  <div className="field" style={{ marginTop: 19 }}>
                    <Field label={t.profile.nameLabel} test="input-profile-name">
                      <input className="input" autoComplete="given-name" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                    </Field>
                  </div>
                  <div className="field-row" style={{ marginTop: 19 }}>
                    <Field label={t.profile.ageLabel} test="input-profile-age">
                      <input className="input" type="number" min="18" max="100" value={profileForm.age} onChange={e => setProfileForm({ ...profileForm, age: Number(e.target.value) })} />
                    </Field>
                    <Field label={t.profile.sexLabel} test="select-profile-sex">
                      <select className="select" value={profileForm.sex} onChange={e => setProfileForm({ ...profileForm, sex: e.target.value as Profile['sex'] })}>
                        <option value="mujer">{t.profile.female}</option>
                        <option value="hombre">{t.profile.male}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="field-row" style={{ marginTop: 13 }}>
                    <Field label={t.profile.heightLabel} test="input-profile-height">
                      <input className="input" type="number" value={profileForm.height} onChange={e => setProfileForm({ ...profileForm, height: Number(e.target.value) })} />
                    </Field>
                    <Field label={t.profile.weightLabel} test="input-profile-weight">
                      <input className="input" type="number" step=".1" value={profileForm.weight} onChange={e => setProfileForm({ ...profileForm, weight: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="field-row" style={{ marginTop: 13 }}>
                    <Field label={t.profile.activityLabel} test="select-profile-activity">
                      <select className="select" value={profileForm.activity} onChange={e => setProfileForm({ ...profileForm, activity: Number(e.target.value) })}>
                        <option value="1.2">{isEn ? 'Mostly seated' : 'Principalmente sentada'}</option>
                        <option value="1.375">{isEn ? 'Light (1–3 days/week)' : 'Ligera (1–3 días/semana)'}</option>
                        <option value="1.45">{isEn ? 'Gentle, daily movement' : 'Suave, con movimiento cotidiano'}</option>
                        <option value="1.55">{isEn ? 'Moderate (3–5 days/week)' : 'Moderada (3–5 días/semana)'}</option>
                        <option value="1.725">{isEn ? 'High (6–7 days/week)' : 'Alta (6–7 días/semana)'}</option>
                      </select>
                    </Field>
                    <Field label={t.profile.goalLabel} test="select-profile-goal">
                      <select className="select" value={profileForm.goal} onChange={e => setProfileForm({ ...profileForm, goal: e.target.value as Profile['goal'] })}>
                        <option value="maintain">{isEn ? 'Maintain' : 'Mantener'}</option>
                        <option value="lose">{isEn ? 'Lose gradually' : 'Perder gradualmente'}</option>
                        <option value="gain">{isEn ? 'Gain gradually' : 'Ganar gradualmente'}</option>
                      </select>
                    </Field>
                  </div>
                  <p className="small-text muted">
                    {isEn
                      ? 'Edit your baseline references here. To track weight history over time, log weigh-ins under Stats.'
                      : 'Puedes modificar estas referencias aquí. Para seguir la evolución del peso, anota nuevas mediciones en Estadísticas.'}
                  </p>
                  {profileForm.goal !== 'maintain' && (
                    <div className="field" style={{ marginTop: 13 }}>
                      <label htmlFor="pace">
                        {isEn ? `Prudent pace: ${profileForm.pace} kg/week` : `Ritmo prudente: ${profileForm.pace} kg/semana`}
                      </label>
                      <input id="pace" type="range" min=".1" max={profileForm.goal === 'lose' ? '.5' : '.3'} step=".1" value={profileForm.pace} onChange={e => setProfileForm({ ...profileForm, pace: Number(e.target.value) })} data-testid="input-profile-pace" />
                      <p className="small-text muted">
                        {isEn
                          ? 'A gradual pace is usually more sustainable. Calculations cap adjustments to avoid extreme targets.'
                          : 'Un ritmo gradual suele ser más sostenible. Los cálculos limitan ajustes para evitar metas extremas.'}
                      </p>
                    </div>
                  )}
                  <div className="field-row" style={{ marginTop: 13 }}>
                    <Field label={t.profile.preferencesLabel} test="input-profile-preferences">
                      <input className="input" placeholder={isEn ? 'Vegetarian, lactose-free…' : 'Vegetariana, sin lactosa…'} value={profileForm.preferences} onChange={e => setProfileForm({ ...profileForm, preferences: e.target.value })} />
                    </Field>
                    <Field label={t.profile.avoidLabel} test="input-profile-avoid">
                      <input className="input" placeholder={isEn ? 'List ingredients' : 'Anota ingredientes'} value={profileForm.avoid} onChange={e => setProfileForm({ ...profileForm, avoid: e.target.value })} />
                    </Field>
                  </div>
                  <div className="field-row" style={{ marginTop: 13 }}>
                    <Field label={t.profile.budgetLabel} test="input-profile-budget">
                      <input className="input" type="number" min="0" step=".5" placeholder={isEn ? 'Optional' : 'Opcional'} value={profileForm.budget ?? ''} onChange={e => setProfileForm({ ...profileForm, budget: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <Field label={t.profile.manualKcalLabel} test="input-profile-manual-calories">
                      <input className="input" type="number" min="1200" max="5000" placeholder={isEn ? 'Use estimate' : 'Usar estimación'} value={profileForm.manualCalories ?? ''} onChange={e => setProfileForm({ ...profileForm, manualCalories: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                  </div>
                  <div className="field-row" style={{ marginTop: 13 }}>
                    <Field label={t.profile.manualProteinLabel} test="input-profile-manual-protein">
                      <input className="input" type="number" min="0" placeholder={isEn ? 'Use estimate' : 'Usar estimación'} value={profileForm.manualProtein ?? ''} onChange={e => setProfileForm({ ...profileForm, manualProtein: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <Field label={t.profile.manualCarbsLabel} test="input-profile-manual-carbs">
                      <input className="input" type="number" min="0" placeholder={isEn ? 'Use estimate' : 'Usar estimación'} value={profileForm.manualCarbs ?? ''} onChange={e => setProfileForm({ ...profileForm, manualCarbs: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                  </div>
                  <div className="field" style={{ marginTop: 13 }}>
                    <Field label={t.profile.manualFatLabel} test="input-profile-manual-fat">
                      <input className="input" type="number" min="0" placeholder={isEn ? 'Use estimate' : 'Usar estimación'} value={profileForm.manualFat ?? ''} onChange={e => setProfileForm({ ...profileForm, manualFat: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <p className="small-text muted">{isEn ? 'Leave blank to use the estimated reference values.' : 'Deja los campos vacíos para usar los valores orientativos.'}</p>
                  </div>
                  <button className="button" style={{ marginTop: 18, width: '100%' }} onClick={saveProfile} data-testid="button-save-profile">
                    <Check size={17} /> {t.profile.saveProfile}
                  </button>
                </section>
                <div className="grid" style={{ alignContent: 'start' }}>
                  <section className="card panel">
                    <div className="eyebrow">{t.profile.dailyRefEyebrow}</div>
                    <h2 className="serif" style={{ fontSize: 26, margin: '7px 0 16px' }}>
                      {t.profile.personalEstimate}
                    </h2>
                    <div className="list-row">
                      <span className="muted">{t.profile.bmr}</span>
                      <b>{profile ? fmt(goal.bmr) : '—'} kcal</b>
                    </div>
                    <div className="list-row">
                      <span className="muted">{t.profile.tdee}</span>
                      <b>{profile ? fmt(goal.tdee) : '—'} kcal</b>
                    </div>
                    <div className="list-row">
                      <span className="muted">{t.profile.dailyGoal}</span>
                      <b>{profile ? fmt(goal.calories) : '2.000'} kcal</b>
                    </div>
                    <div className="divider" />
                    <div className="small-text muted">
                      {isEn
                        ? `Suggested macros: protein ${fmt(goal.protein)} g · carbs ${fmt(goal.carbs)} g · fat ${fmt(goal.fat)} g. Real needs vary; consult a healthcare professional if needed.`
                        : `Macros orientativos: proteína ${fmt(goal.protein)} g · carbohidratos ${fmt(goal.carbs)} g · grasas ${fmt(goal.fat)} g. Las necesidades reales varían; consulta con un profesional si lo necesitas.`}
                    </div>
                  </section>
                  <section className="card panel">
                    <h2 className="serif" style={{ fontSize: 25, margin: '0 0 8px' }}>
                      {t.profile.remindersTitle}
                    </h2>
                    <p className="small-text muted">
                      {isEn ? 'In-app gentle prompts, without OS push notifications.' : 'Avisos dentro de esta aplicación, sin notificaciones del sistema.'}
                    </p>
                    <label className="check-line" style={{ margin: '15px 0' }}>
                      <input type="checkbox" checked={reminderDraft.enabled} onChange={e => setReminderDraft({ ...reminderDraft, enabled: e.target.checked })} data-testid="toggle-reminder-enabled" /> {t.profile.enableReminders}
                    </label>
                    <div className="field-row">
                      {reminderDraft.times.map((time, i) => (
                        <Field key={i} label={isEn ? `Time ${i + 1}` : `Hora ${i + 1}`} test={`input-reminder-time-${i + 1}`}>
                          <input className="input" type="time" value={time} onChange={e => setReminderDraft({ ...reminderDraft, times: reminderDraft.times.map((tItem, j) => (i === j ? e.target.value : tItem)) })} />
                        </Field>
                      ))}
                    </div>
                    <button className="button secondary" style={{ width: '100%', marginTop: 14 }} onClick={saveReminder} data-testid="button-save-reminders">
                      {t.profile.saveTimes}
                    </button>
                    {reminderDraft.enabled && (
                      <p className="small-text muted">
                        {isEn
                          ? 'You will see a gentle banner inside Mi Nutrición during your chosen times. No background alerts are sent.'
                          : 'Verás un recordatorio discreto al abrir Mi Nutrición en los horarios elegidos. No se envían avisos en segundo plano.'}
                      </p>
                    )}
                  </section>
                </div>
              </div>
              <section className="card panel" style={{ marginTop: 18 }}>
                <div className="eyebrow">{t.profile.accountEyebrow}</div>
                <h2 className="serif" style={{ fontSize: 25, margin: '7px 0' }}>
                  {t.profile.accountTitle}
                </h2>
                <p className="small-text muted">
                  {isEn ? (
                    <>
                      Signed in as <b>{session.user.email}</b>. Your data is cached locally and synced privately with your cloud account.
                    </>
                  ) : (
                    <>
                      Has iniciado sesión como <b>{session.user.email}</b>. Tus datos se guardan en caché local y se sincronizan de forma privada con tu cuenta en la nube.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 15 }}>
                  <button className="button secondary" onClick={() => void handleSignOut()} data-testid="button-sign-out">
                    <LogOut size={16} /> {t.profile.signOut}
                  </button>
                  <button className="button secondary" onClick={exportData} data-testid="button-export-data">
                    <ArrowDownToLine size={16} /> {t.profile.exportJson}
                  </button>
                  <button className="button secondary" onClick={() => importInputRef.current?.click()} data-testid="button-import-data">
                    <ArrowUpFromLine size={16} /> {isEn ? 'Import JSON backup' : 'Importar copia JSON'}
                  </button>
                  <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
                  <button className="button danger" onClick={removePersonalData} data-testid="button-delete-personal-data">
                    <Trash2 size={16} /> {t.profile.deleteData}
                  </button>
                </div>
              </section>
              <section className="card panel" style={{ marginTop: 18 }}>
                <h2 className="serif" style={{ fontSize: 24, margin: '0 0 6px' }}>
                  {isEn ? 'How to use' : 'Cómo usarlo'}
                </h2>
                <p className="small-text muted">
                  {isEn
                    ? 'The starter catalog includes generic BEDCA/AESAN foods and ingredient-calculated recipes. For packaged foods, scan or enter a barcode via Open Food Facts and confirm values with the physical label before saving. Your profile and logs sync with your account across devices.'
                    : 'El catálogo inicial incluye alimentos genéricos de BEDCA/AESAN y recetas calculadas desde sus ingredientes. Para productos envasados, consulta Open Food Facts por código de barras y confirma los valores con la etiqueta antes de guardarlos. Tu perfil y registros personales se sincronizan con tu cuenta para acceder desde cualquier dispositivo.'}
                </p>
              </section>
            </main>
          </Route>
          <Route>
            <main className="page-wrap">
              <div className="card panel">
                <h1 className="page-title">{isEn ? 'Page not found' : 'No encontramos esa página'}</h1>
                <Link href="/" className="button" data-testid="link-back-home">
                  {isEn ? 'Back to Today' : 'Volver a Hoy'}
                </Link>
              </div>
            </main>
          </Route>
        </Switch>
      )}
      {!needsProfileSetup && (
        <nav className="mobile-nav" aria-label={isEn ? 'Bottom navigation' : 'Navegación inferior'}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={path === item.href ? 'active' : ''} data-testid={`mobile-link-${item.href === '/' ? 'hoy' : item.href.slice(1)}`}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-head">
              <div>
                <div className="eyebrow">Mi Nutrición</div>
                <h2 id="modal-title" className="serif" style={{ fontSize: 28, margin: '4px 0' }}>
                  {modal === 'food'
                    ? offReviewPending
                      ? isEn
                        ? 'Verify packaged product'
                        : 'Revisar producto envasado'
                      : editId
                      ? isEn
                        ? 'Edit food'
                        : 'Editar alimento'
                      : isEn
                      ? 'New food'
                      : 'Nuevo alimento'
                    : modal === 'dish'
                    ? editId
                      ? isEn
                        ? 'Edit dish'
                        : 'Editar plato'
                      : isEn
                      ? 'Your new dish'
                      : 'Tu nuevo plato'
                    : modal === 'weight'
                    ? isEn
                      ? 'Log weight'
                      : 'Anotar peso'
                    : isEn
                    ? 'Add to your log'
                    : 'Añadir a tu registro'}
                </h2>
              </div>
              <button className="icon-button" onClick={() => setModal(null)} aria-label={isEn ? 'Close' : 'Cerrar'} data-testid="button-close-modal">
                <X />
              </button>
            </div>
            {modal === 'food' && (
              <div className="grid">
                <div className="field">
                  <label>{isEn ? 'Name' : 'Nombre'}</label>
                  <input
                    className="input"
                    value={foodDraft.name}
                    onChange={e => {
                      setFoodDraft({ ...foodDraft, name: e.target.value });
                      if (offReviewPending) setOffLabelConfirmed(false);
                    }}
                    data-testid="input-food-name"
                  />
                </div>
                <div className="field-row">
                  <Field label={isEn ? 'Usual unit' : 'Unidad habitual'} test="select-food-unit">
                    <select className="select" value={foodDraft.unit} onChange={e => setFoodDraft({ ...foodDraft, unit: e.target.value })}>
                      <option value="g">{isEn ? 'grams' : 'gramos'}</option>
                      <option value="unidad">{isEn ? 'unit' : 'unidad'}</option>
                      <option value="rebanada">{isEn ? 'slice' : 'rebanada'}</option>
                      <option value="ración">{isEn ? 'serving' : 'ración'}</option>
                      <option value="cucharadita">{isEn ? 'teaspoon' : 'cucharadita'}</option>
                    </select>
                  </Field>
                  <Field label={isEn ? 'Grams per unit' : 'Gramos por unidad'} test="input-food-unit-grams">
                    <input className="input" type="number" value={foodDraft.gramsPerUnit} onChange={e => setFoodDraft({ ...foodDraft, gramsPerUnit: e.target.value })} />
                  </Field>
                </div>
                <p className="small-text muted" style={{ margin: '-8px 0 0' }}>
                  {isEn
                    ? `Nutritional values per 100 g. ${offReviewPending ? 'Compare with the physical label; fix any discrepancy before saving.' : 'Enter values from the package label or cited source.'}`
                    : `Valores nutricionales por 100 g. ${offReviewPending ? 'Contrástalos con el envase real; si difieren, corrígelos antes de guardar.' : 'Indica valores de la etiqueta o la fuente citada.'}`}
                </p>
                <div className="field-row">
                  {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => (
                    <Field
                      key={k}
                      label={
                        isEn
                          ? { kcal: 'Energy kcal', protein: 'Protein g', carbs: 'Carbs g', fat: 'Fat g' }[k]
                          : { kcal: 'Energía kcal', protein: 'Proteína g', carbs: 'Carbohidratos g', fat: 'Grasas g' }[k]
                      }
                      test={`input-food-${k}`}
                    >
                      <input
                        className="input"
                        type="number"
                        step=".1"
                        min="0"
                        value={foodDraft[k]}
                        onChange={e => {
                          setFoodDraft({ ...foodDraft, [k]: e.target.value });
                          if (offReviewPending) setOffLabelConfirmed(false);
                        }}
                      />
                    </Field>
                  ))}
                </div>
                <div className="field-row">
                  <Field label={isEn ? 'Barcode (optional)' : 'Código de barras (opcional)'} test="input-food-barcode">
                    <input className="input" value={foodDraft.barcode} onChange={e => setFoodDraft({ ...foodDraft, barcode: e.target.value })} readOnly={offReviewPending} />
                  </Field>
                  <Field label={isEn ? 'Source / reference' : 'Fuente / referencia'} test="input-food-source">
                    <input className="input" value={foodDraft.source} onChange={e => setFoodDraft({ ...foodDraft, source: e.target.value })} readOnly={offReviewPending} />
                  </Field>
                </div>
                {offReviewPending ? (
                  <div className="card panel" style={{ background: 'var(--app-surface-raised)' }}>
                    <p className="small-text muted" style={{ marginTop: 0 }}>
                      {isEn
                        ? 'Open Food Facts does not guarantee listing accuracy. Confirm only after comparing the name and values with the physical package; fix any differences first. This does not verify allergens or prevent medical errors.'
                        : 'Open Food Facts no garantiza que la ficha sea exacta. Confirma solo después de comparar el nombre y los valores con el envase; corrige antes cualquier diferencia. Esto no verifica alérgenos ni evita errores médicos.'}
                    </p>
                    <label className="check-line">
                      <input type="checkbox" checked={offLabelConfirmed} onChange={e => setOffLabelConfirmed(e.target.checked)} data-testid="checkbox-confirm-product-label" />{' '}
                      {isEn
                        ? 'I have compared this information with the package label and corrected any differences.'
                        : 'He comparado la información con la etiqueta del envase y corregido cualquier diferencia.'}
                    </label>
                  </div>
                ) : (
                  <p className="small-text muted">
                    {isEn ? `Reviewed: ${today()} · Personal foods sync with your account.` : `Revisión: ${today()} · Los datos personales se sincronizan con tu cuenta.`}
                  </p>
                )}
                <button className="button" onClick={saveFood} disabled={offReviewPending && !offLabelConfirmed} data-testid="button-save-food">
                  <Check size={16} /> {isEn ? 'Save food' : 'Guardar alimento'}
                </button>
              </div>
            )}
            {modal === 'log' && <MealEntryPicker options={logOptions} initialTab={logTab} initialSelection={logSelection} date={selectedDate} meal={selectedMeal} onMealChange={setSelectedMeal} onCreateDish={createDishFromLog} onConfirm={confirmMealLog} />}
            {modal === 'dish' && (
              <div className="grid">
                <div className="field">
                  <label>{isEn ? 'Dish name' : 'Nombre del plato'}</label>
                  <input className="input" value={dishDraft.name} onChange={e => setDishDraft({ ...dishDraft, name: e.target.value })} data-testid="input-dish-name" />
                </div>
                <div className="field">
                  <label>{isEn ? 'Description' : 'Descripción'}</label>
                  <input className="input" value={dishDraft.description} onChange={e => setDishDraft({ ...dishDraft, description: e.target.value })} data-testid="input-dish-description" />
                </div>
                <div className="field-row">
                  <Field label={isEn ? 'Servings' : 'Raciones'} test="input-dish-servings">
                    <input className="input" type="number" min="1" value={dishDraft.servings} onChange={e => setDishDraft({ ...dishDraft, servings: Number(e.target.value) })} />
                  </Field>
                  <Field label={isEn ? 'Estimated cost € (optional)' : 'Coste estimado € (opcional)'} test="input-dish-cost">
                    <input className="input" type="number" min="0" step=".1" value={dishDraft.cost ?? ''} onChange={e => setDishDraft({ ...dishDraft, cost: e.target.value ? Number(e.target.value) : undefined })} />
                  </Field>
                </div>
                <div className="field-row">
                  <Field label={isEn ? 'Notes' : 'Notas'} test="input-dish-notes">
                    <input className="input" value={dishDraft.notes} onChange={e => setDishDraft({ ...dishDraft, notes: e.target.value })} />
                  </Field>
                  <Field label={isEn ? 'Tags, comma-separated' : 'Etiquetas, separadas por coma'} test="input-dish-tags">
                    <input
                      className="input"
                      value={dishDraft.tags.join(', ')}
                      onChange={e =>
                        setDishDraft({
                          ...dishDraft,
                          tags: e.target.value
                            .split(',')
                            .map(x => x.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label={isEn ? 'Optional local photo' : 'Foto local opcional'} test="input-dish-photo">
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 450000) {
                        setPhotoError(
                          isEn
                            ? 'Image exceeds 450 KB. Reduce its size or save the dish without a photo.'
                            : 'La imagen supera 450 KB. Reduce su tamaño o guarda el plato sin foto para que quepa en el navegador.'
                        );
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setDishDraft({ ...dishDraft, photo: String(reader.result) });
                        setPhotoError('');
                      };
                      reader.onerror = () =>
                        setPhotoError(isEn ? 'Could not read image.' : 'No pudimos leer esta imagen. Puedes guardar el plato sin foto.');
                      reader.readAsDataURL(file);
                    }}
                  />
                </Field>
                {photoError && (
                  <p className="small-text" role="alert" style={{ color: '#a14c3f' }}>
                    {photoError}
                  </p>
                )}
                {dishDraft.photo && (
                  <div className="small-text muted">
                    {isEn ? 'Photo selected and saved locally.' : 'Foto seleccionada y guardada localmente.'}{' '}
                    <button className="button ghost small" onClick={() => setDishDraft({ ...dishDraft, photo: undefined })} data-testid="button-remove-dish-photo">
                      {isEn ? 'Remove photo' : 'Quitar foto'}
                    </button>
                  </div>
                )}
                <Field label={isEn ? 'Filter ingredients by category' : 'Filtrar ingredientes por categoría'} test="select-dish-ingredient-category">
                  <select
                    className="select"
                    value={ingredientCategory}
                    onChange={e => {
                      setIngredientCategory(e.target.value as FoodCategory | 'Todas');
                      setIngredientPick('');
                    }}
                  >
                    <option value="Todas">{labelCategory('Todas', lang)}</option>
                    {foodCategories.map(category => (
                      <option key={category} value={category}>
                        {labelCategory(category, lang)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="field-row">
                  <Field label={isEn ? 'Food' : 'Alimento'} test="select-dish-ingredient">
                    <select className="select" value={ingredientPick} onChange={e => setIngredientPick(e.target.value)}>
                      <option value="">{isEn ? 'Choose food' : 'Elige alimento'}</option>
                      {allFoods
                        .filter(f => foodMatchesCategory(f, ingredientCategory))
                        .map(f => (
                          <option key={f.id} value={f.id}>
                            {foodDisplayName(f.id, f.name, lang)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={isEn ? 'Amount (g)' : 'Cantidad (g)'} test="input-dish-ingredient-grams">
                    <input className="input" type="number" value={ingredientGrams} onChange={e => setIngredientGrams(e.target.value)} />
                  </Field>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    if (!ingredientPick) return;
                    setDishDraft({ ...dishDraft, ingredients: [...dishDraft.ingredients, { foodId: ingredientPick, grams: Number(ingredientGrams) || 100 }] });
                    setIngredientPick('');
                  }}
                  data-testid="button-add-dish-ingredient"
                >
                  <Plus size={15} /> {isEn ? 'Add ingredient' : 'Añadir ingrediente'}
                </button>
                {dishDraft.ingredients.map((ing, i) => (
                  <div className="list-row" key={`${ing.foodId}-${i}`}>
                    <span>
                      {foodDisplayName(ing.foodId, foodById(ing.foodId, allFoods)?.name ?? '', lang)} · {ing.grams} g
                    </span>
                    <button
                      className="icon-button"
                      aria-label={isEn ? 'Remove ingredient' : 'Quitar ingrediente'}
                      onClick={() => setDishDraft({ ...dishDraft, ingredients: dishDraft.ingredients.filter((_, j) => j !== i) })}
                      data-testid={`button-remove-dish-ingredient-${i}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="pill">
                  {isEn ? 'Per serving' : 'Por ración'}: {fmt(dishStats(dishDraft).kcal)} kcal · P {dishStats(dishDraft).protein.toFixed(1)} · C {dishStats(dishDraft).carbs.toFixed(1)} · {isEn ? 'F' : 'G'} {dishStats(dishDraft).fat.toFixed(1)} g
                </div>
                <button className="button" onClick={saveDish} data-testid="button-save-dish">
                  <Check size={16} /> {isEn ? 'Save my dish' : 'Guardar mi plato'}
                </button>
              </div>
            )}
            {modal === 'weight' && (
              <div className="grid">
                <div className="field-row">
                  <Field label={isEn ? 'Date' : 'Fecha'} test="input-weight-date">
                    <input className="input" type="date" value={weightDraft.date} onChange={e => setWeightDraft({ ...weightDraft, date: e.target.value })} />
                  </Field>
                  <Field label={isEn ? 'Weight (kg)' : 'Peso (kg)'} test="input-weight-value">
                    <input className="input" type="number" step=".1" value={weightDraft.weight} onChange={e => setWeightDraft({ ...weightDraft, weight: e.target.value })} />
                  </Field>
                </div>
                <Field label={isEn ? 'Optional note' : 'Nota opcional'} test="input-weight-note">
                  <input className="input" value={weightDraft.note} onChange={e => setWeightDraft({ ...weightDraft, note: e.target.value })} />
                </Field>
                <button className="button" onClick={saveWeight} data-testid="button-save-weight">
                  {isEn ? 'Save entry' : 'Guardar registro'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" data-testid="status-toast">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;