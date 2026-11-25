import { cloneElement, isValidElement, type ChangeEvent, type PointerEvent as PointerEventType, type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import type { Session } from '@supabase/supabase-js';
import { Activity, ArrowDownToLine, ArrowUpFromLine, BarChart3, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, GripVertical, Heart, Leaf, LogOut, Plus, Search, Settings2, Trash2, Utensils, X } from 'lucide-react';
import { addNutrients, blankProfile, demoFoods, demoRecipes, foodById, foodCategories, foodMatchesCategory, id, mealNames, moveLogEntry, multiplyNutrients, nutrientsPerServing, recipeFit, recipeMatchesAvoidance, recipeNutrition, recipePreferenceScore, scaled, shiftDate, sumLogs, targets, today, weekDateKeys, weekLoggedDateKeys, type Dish, type Food, type FoodCategory, type LogEntry, type Meal, type Nutrients, type Profile, type Recipe, type Store, type WeightEntry } from './lib/domain';
import { bedcaFoods, bedcaRecipes } from './lib/bedca-catalog';
import { lookupOpenFoodFactsProduct, type OpenFoodFactsProduct } from './lib/openfoodfacts';
import { clearPersonalStore, loadCloudStore, loadStore, saveCloudStore, saveStore } from './lib/storage';
import { supabase } from './lib/supabase';
import { getLocale, labelCategory, labelMeal, translations, useLang } from './lib/i18n';
import AuthGate from './components/AuthGate';
import ProfileOnboarding from './components/ProfileOnboarding';
import MealEntryPicker, { type MealEntryOption } from './components/MealEntryPicker';
import NutrientSummary from './components/NutrientSummary';
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
  const t = translations[lang];
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
        .filter(f => f.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))
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
    [allFoods, search, locale, filter, foodCategory, store.favorites, store.recent]
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

  const logOptions = useMemo<MealEntryOption[]>(() => {
    const foodOptions: MealEntryOption[] = allFoods.map(food => ({
      key: `food:${food.id}`,
      id: food.id,
      kind: 'food',
      name: food.name,
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
      unit: food.unit,
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
        return {
          key: `recipe:${recipe.id}`,
          id: recipe.id,
          kind: 'recipe' as const,
          name: recipe.name,
          source: recipe.demo
            ? isEn
              ? 'Suggested recipe · sample'
              : 'Receta sugerida · ejemplo orientativo'
            : isEn
            ? 'Suggested recipe · BEDCA'
            : 'Receta sugerida · BEDCA',
          nutrients,
          tags: recipe.tags,
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
      name: entry.name,
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
  }, [allFoods, isEn, profile?.avoid, profile?.preferences, remaining, store.dishes, store.logs]);

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
          ? `${food.name} added to ${labelMeal(meal, lang).toLowerCase()}.`
          : `${food.name} añadido a ${meal.toLowerCase()}.`
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
    const msg = isEn ? `Delete entry for ${entry.name}?` : `¿Eliminar el registro de ${entry.name}?`;
    if (!window.confirm(msg)) return;
    update(s => ({ ...s, logs: s.logs.filter(l => l.id !== logId) }));
    notify(isEn ? 'Entry deleted.' : 'Registro eliminado.');
  }

  function moveLog(logId: string, meal: Meal) {
    const entry = store.logs.find(l => l.id === logId);
    if (!entry || entry.meal === meal) return;
    update(s => ({ ...s, logs: moveLogEntry(s.logs, logId, meal) }));
    notify(
      isEn
        ? `${entry.name} moved to ${labelMeal(meal, lang).toLowerCase()}.`
        : `${entry.name} movido a ${meal.toLowerCase()}.`
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

  function dishStats(d: Dish) {
    return calculateDishNutrients(d, allFoods);
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
                            {f.name}
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
                      {foodById(ing.foodId, allFoods)?.name} · {ing.grams} g
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

function Field({ label, test, children }: { label: string; test: string; children: ReactNode }) {
  const control = isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id: test, 'data-testid': test }) : children;
  return (
    <div className="field">
      <label htmlFor={test}>{label}</label>
      {control}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <div style={{ fontFamily: 'var(--app-font-serif)', fontSize: 21, marginBottom: 5 }}>{title}</div>
      <div className="small-text muted">{text}</div>
    </div>
  );
}
function MacroMeter({ name, value, target, color }: { name: string; value: number; target: number; color: string }) {
  const percent = target > 0 ? Math.min(100, (value / target) * 100) : 0;
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
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function WeekCalendar({ date, setDate, loggedDates }: { date: string; setDate: (date: string) => void; loggedDates: ReadonlySet<string> }) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = translations[lang];
  const locale = getLocale(lang);
  const days = weekDateKeys(date).map(dateFromKey);
  const currentDate = today();
  const weekLabel =
    days[0].getMonth() === days[6].getMonth()
      ? `${days[0].getDate()}–${days[6].getDate()} ${days[6].toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
      : `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}–${days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
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
          const key = dateKey(day),
            isSelected = key === date,
            isToday = key === currentDate,
            hasLogs = loggedDates.has(key);
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

function TodayPage({
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
  const t = translations[lang];
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

  const recs = allRecipes
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
                  ? list.map(l => (
                      <div className={`food-row${draggingLogId === l.id ? ' is-dragging' : ''}`} key={l.id}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <b style={{ fontSize: 13 }}>{l.name}</b>
                          <div className="small-text muted">
                            {l.grams ? `${fmt(l.grams)} g` : `${fmt(l.amount)} ${l.unit === 'ud' ? t.today.servingsUnit : 'g'}`} · {fmt(l.nutrients.kcal)} kcal{' '}
                            {l.demo && (
                              <span className="pill demo-pill" style={{ marginLeft: 5 }}>
                                {t.today.demoTag}
                              </span>
                            )}
                          </div>
                          <NutrientSummary nutrients={l.nutrients} label={l.name} />
                        </div>
                        <div className="food-row-actions">
                          <button
                            type="button"
                            id={`drag-log-${l.id}`}
                            className="log-drag-handle"
                            aria-label={`${isEn ? 'Move' : 'Mover'} ${l.name}`}
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
                          <button className="icon-button" aria-label={`${isEn ? 'Delete' : 'Eliminar'} ${l.name}`} onClick={() => onDelete(l.id)} data-testid={`button-delete-log-${l.id}`}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))
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
            recs.map(({ recipe, perServing, preferred, fits }) => (
              <article className="today-recipe-card" key={recipe.id} data-testid={`card-today-recipe-${recipe.id}`}>
                <div className="today-recipe-heading">
                  <div className="today-recipe-copy">
                    <b>{recipe.name}</b>
                    <span className="small-text muted">
                      {recipe.minutes} min{preferred ? ` · ${t.today.matchesPrefs}` : ''}
                    </span>
                  </div>
                  <div className="today-recipe-actions">
                    <span className="pill">{fits ? t.today.canFit : t.today.freeChoice}</span>
                    <button type="button" className="button secondary small" aria-label={`${t.today.addBtn} ${recipe.name}`} onClick={() => onRecipe(recipe)} data-testid={`button-log-suggested-recipe-${recipe.id}`}>
                      {t.today.addBtn}
                    </button>
                  </div>
                </div>
                <NutrientSummary nutrients={perServing} label={recipe.name} />
              </article>
            ))
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

function FoodRow({ food, favorite, onFavorite, onEdit, onDelete, onAdd }: { food: Food; favorite: boolean; onFavorite: () => void; onEdit: () => void; onDelete: () => void; onAdd: () => void }) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  return (
    <div className="list-row" data-testid={`row-food-${food.id}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{food.name}</b>
          {food.category && <span className="pill">{labelCategory(food.category, lang)}</span>}
          {food.catalog && <span className="pill">BEDCA</span>}
          {food.demo && <span className="pill demo-pill">{isEn ? 'Sample' : 'Ejemplo'}</span>}
          {food.source.startsWith('Open Food Facts') && <span className="pill demo-pill">{isEn ? 'Label checked' : 'Etiqueta revisada'}</span>}
        </div>
        <div className="small-text muted">
          {fmt(food.kcal)} kcal · P {food.protein.toFixed(1)} · C {food.carbs.toFixed(1)} · {isEn ? 'F' : 'G'} {food.fat.toFixed(1)} g / 100 g · {food.source}
        </div>
        <div className="small-text muted">
          {isEn ? 'Reviewed' : 'Revisado'}: {food.reviewed}
          {food.barcode ? ` · ${isEn ? 'Barcode' : 'Código'}: ${food.barcode}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <button className="icon-button" onClick={onFavorite} aria-label={favorite ? (isEn ? 'Remove favorite' : 'Quitar de favoritos') : isEn ? 'Add favorite' : 'Añadir a favoritos'} data-testid={`button-favorite-food-${food.id}`}>
          <Heart size={17} fill={favorite ? '#729574' : 'none'} color={favorite ? '#729574' : 'currentColor'} />
        </button>
        {!food.demo && !food.catalog && (
          <>
            <button className="icon-button" onClick={onEdit} aria-label={`${isEn ? 'Edit' : 'Editar'} ${food.name}`} data-testid={`button-edit-food-${food.id}`}>
              <Settings2 size={16} />
            </button>
            <button className="icon-button" onClick={onDelete} aria-label={`${isEn ? 'Delete' : 'Eliminar'} ${food.name}`} data-testid={`button-delete-food-${food.id}`}>
              <Trash2 size={16} />
            </button>
          </>
        )}
        <button className="button secondary small" onClick={onAdd} data-testid={`button-add-food-${food.id}`}>
          <Plus size={14} /> {isEn ? 'Add' : 'Añadir'}
        </button>
      </div>
    </div>
  );
}

function RecipeSection({
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
  const t = translations[lang];

  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const favoriteFoods = foods.filter(f => favorites.includes(f.id));
  const avoidedNames = (profile?.avoid ?? '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
  const list = recipes
    .filter(r => !filters.favorites || recipeFavorites.includes(r.id))
    .filter(r => !filters.available || r.ingredients.every(i => favoriteFoods.some(f => f.id === i.foodId)))
    .filter(r => !availableOnly || r.ingredients.every(i => availableIds.includes(i.foodId)))
    .filter(r => r.ingredients.every(i => !excluded.includes(i.foodId)))
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
          <button className={`tab ${filters.favorites ? 'selected' : ''}`} onClick={() => toggle('favorites')} data-testid="toggle-recipe-favorites">
            {t.recipes.favRecipes}
          </button>
          <button className={`tab ${filters.available ? 'selected' : ''}`} onClick={() => toggle('available')} data-testid="toggle-recipe-available">
            {t.recipes.favFoodsBased}
          </button>
          <button className={`tab ${availableOnly ? 'selected' : ''}`} onClick={() => setAvailableOnly(!availableOnly)} data-testid="toggle-recipe-available-in-pantry">
            {t.recipes.onlyPantry}
          </button>
          <button className={`tab ${filters.fit ? 'selected' : ''}`} onClick={() => toggle('fit')} data-testid="toggle-recipe-fit">
            {t.recipes.fitsMacros}
          </button>
        </div>
        {availableOnly && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{t.recipes.markAvailable}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {foods.map(f => (
                <button className={`tab ${availableIds.includes(f.id) ? 'selected' : ''}`} key={f.id} onClick={() => setAvailableIds(availableIds.includes(f.id) ? availableIds.filter(x => x !== f.id) : [...availableIds, f.id])} data-testid={`toggle-pantry-food-${f.id}`}>
                  {f.name}
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
            {foods.map(f => (
              <button className={`tab ${excluded.includes(f.id) ? 'selected' : ''}`} key={f.id} onClick={() => setExcluded(excluded.includes(f.id) ? excluded.filter(x => x !== f.id) : [...excluded, f.id])} data-testid={`toggle-exclude-food-${f.id}`}>
                {f.name}
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
          return (
            <article className="card recipe-card" key={r.id} data-testid={`card-recipe-${r.id}`}>
              <div className="recipe-card-meta">
                <div className="eyebrow">{r.tags.join(' · ')}</div>
                <span className={`pill ${r.demo ? 'demo-pill' : ''}`}>{r.demo ? (isEn ? 'Sample reference' : 'Ejemplo orientativo') : isEn ? 'Calculated with BEDCA' : 'Calculado con BEDCA'}</span>
              </div>
              <h2 className="serif recipe-card-title">{r.name}</h2>
              <p className="small-text muted recipe-card-description">{r.description}</p>
              <NutrientSummary nutrients={each} label={r.name} />
              <div className="small-text muted recipe-card-time">
                <Clock3 size={13} style={{ verticalAlign: '-2px' }} /> {r.minutes} min{r.cost !== undefined ? ` · €${r.cost.toFixed(2)} ${isEn ? 'approx.' : 'aprox.'}` : ''} · {r.servings}{' '}
                {r.servings === 1 ? (isEn ? 'serving' : 'ración') : isEn ? 'servings' : 'raciones'}
              </div>
              <div className="small-text muted recipe-card-ingredients">
                {isEn ? 'Ingredients' : 'Ingredientes'}: {r.ingredients.map(i => `${foodById(i.foodId, foods)?.name ?? (isEn ? 'Food' : 'Alimento')} (${fmt(i.grams)} g)`).join(', ')}.
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

function Stats({ store, mode, goal, onRemoveWeight }: { store: Store; mode: 'Semana' | 'Mes'; goal: ReturnType<typeof targets>; onRemoveWeight: (id: string) => void }) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const t = translations[lang];
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

export default App;