import { foodDisplayName, getLocale, labelCategory, labelMeal, recipeDisplay, translations, useLang } from './lib/i18n';
import { useEffect, useState } from 'react';
import type { FoodCategory, Meal, Profile } from './domain';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'mi-nutricion-lang';

export function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // ignore storage errors
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function setStoredLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent('app:lang-change', { detail: lang }));
}

export function useLang(): [Lang, (next: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    const handler = (event: Event) => {
      const next = (event as CustomEvent<Lang>).detail;
      if (next === 'es' || next === 'en') setLangState(next);
    };
    window.addEventListener('app:lang-change', handler);
    return () => window.removeEventListener('app:lang-change', handler);
  }, [lang]);

  const updateLang = (next: Lang) => {
    setLangState(next);
    setStoredLang(next);
  };

  return [lang, updateLang];
}

export function getLocale(lang: Lang): string {
  return lang === 'en' ? 'en-US' : 'es-ES';
}

// Traducción visual de valores internos de dominio (sin alterar lo guardado en Supabase)
export function labelMeal(meal: Meal, lang: Lang): string {
  if (lang === 'es') return meal;
  const map: Record<string, string> = {
    Desayuno: 'Breakfast',
    Comida: 'Lunch',
    Merienda: 'Snack',
    Cena: 'Dinner',
  };
  return map[meal] ?? meal;
}

export function labelCategory(category: FoodCategory | 'Todas', lang: Lang): string {
  if (lang === 'es') return category;
  const map: Record<string, string> = {
    Todas: 'All categories',
    'Carnes y aves': 'Meat & poultry',
    'Pescados y mariscos': 'Fish & seafood',
    'Huevos y lácteos': 'Eggs & dairy',
    'Cereales y pan': 'Grains & bread',
    Legumbres: 'Legumes',
    'Frutas y verduras': 'Fruits & vegetables',
    'Frutos secos y semillas': 'Nuts & seeds',
    'Aceites y grasas': 'Oils & fats',
    Otros: 'Other',
  };
  return map[category] ?? category;
}

export function labelGoal(goal: Profile['goal'], lang: Lang): string {
  if (lang === 'es') {
    return goal === 'lose' ? 'Perder gradualmente' : goal === 'gain' ? 'Ganar gradualmente' : 'Mantener';
  }
  return goal === 'lose' ? 'Lose gradually' : goal === 'gain' ? 'Gain gradually' : 'Maintain';
}

export const translations = {
  es: {
    brand: 'mi nutrición',
    synced: 'Sincronizado',
    loadingSpace: 'Cargando tu espacio personal…',
    nav: {
      today: 'Hoy',
      foods: 'Alimentos',
      recipes: 'Recetas',
      stats: 'Estadísticas',
      profile: 'Perfil',
    },
    today: {
      helloNamed: (name: string) => `Hola, ${name}`,
      helloGeneric: 'Hola, ¿cómo te sientes?',
      subtitle: 'Un registro amable empieza por lo que ya has hecho. Sin días perfectos ni días perdidos.',
      addLog: 'Añadir registro',
      yourWeek: 'Tu semana',
      prevWeek: 'Semana anterior',
      nextWeek: 'Semana siguiente',
      todayBtn: 'Hoy',
      loggedDaysLegend: 'Días con comidas registradas',
      reminderTitle: 'Una pausa para cuidarte',
      reminderBody: 'Si te viene bien, registra algo que hayas comido. También puedes dejarlo para después.',
      energyLogged: 'Energía registrada',
      remainingKcal: (kcal: string) => `${kcal} kcal para tu referencia diaria`,
      overKcal: (kcal: string) => `${kcal} kcal por encima de tu referencia; es una estimación, no una calificación.`,
      macros: 'Macronutrientes',
      protein: 'Proteína',
      carbs: 'Carbohidratos',
      fat: 'Grasas',
      yourDay: 'Tu día, a tu ritmo',
      mealLogTitle: 'Registro de comidas',
      emptyLog: 'Tu registro está vacío por ahora. Puedes añadir alimentos cuando quieras.',
      servingsUnit: 'raciones',
      demoTag: 'Ejemplo',
      ideaForToday: 'Una idea para hoy',
      couldFit: 'Podría encajarte',
      seeRecipes: 'Ver recetas',
      matchesPrefs: 'Afín a tus preferencias',
      canFit: 'Puede encajar',
      freeChoice: 'Elección libre',
      addBtn: 'Añadir',
      noExactSuggestions: 'Sin sugerencias exactas ahora',
      noExactSuggestionsText: 'Puedes explorar todas las recetas y elegir con libertad.',
      compatibilityNote: 'La compatibilidad compara macros aproximados por ración con lo que queda de tu referencia; orienta, no decide por ti. Las preferencias y exclusiones del perfil guían estas sugerencias.',
      yourDishes: 'Tus platos',
      madeByYou: 'Hechos por ti',
      yourDishPerServing: 'Tu plato · por ración',
      collectionStartsHere: 'Tu colección empieza aquí',
      collectionStartsText: 'Crea un plato propio desde Alimentos para repetirlo fácilmente.',
      createFirstDish: 'Crear un plato',
      disclaimer: 'Referencia orientativa, no consejo médico. Puedes ajustar o desactivar tus objetivos desde Perfil.',
    },
    foods: {
      eyebrow: 'Tu despensa de referencia',
      title: 'Alimentos',
      subtitle: 'Catálogo español de composición BEDCA/AESAN, ejemplos claramente marcados y alimentos personales sincronizados en tu cuenta.',
      createFood: 'Crear alimento',
      packagedEyebrow: 'Productos envasados',
      offTitle: 'Consultar Open Food Facts',
      offDesc: 'Busca por código de barras. Sus datos son aportados por colaboradores y pueden ser incompletos o erróneos; aquí solo se usan como referencia. Al consultar, se envía ese código a Open Food Facts; no se envían tu perfil ni tus registros.',
      barcodeLabel: 'Código de barras (8–14 cifras)',
      barcodePlaceholder: 'Por ejemplo, 3017620422003',
      searching: 'Consultando…',
      searchProduct: 'Buscar producto',
      viewSheet: 'Ver ficha',
      reviewBeforeSave: 'Revisar con el envase antes de guardar',
      searchPlaceholder: 'Buscar alimentos',
      showLabel: 'Mostrar',
      categoryLabel: 'Categoría',
      filters: {
        all: 'Todos',
        bedca: 'BEDCA',
        favorites: 'Favoritos',
        recent: 'Recientes',
        mine: 'Mis alimentos',
        examples: 'Ejemplos',
      },
      notFoundTitle: 'No encontramos ese alimento',
      notFoundText: 'Prueba con otro término, cambia el filtro o crea tu propio alimento.',
      dishesEyebrow: 'Tus platos personales',
      dishesTitle: 'Ideas hechas a tu manera',
      dishesSubtitle: 'Combina alimentos conocidos y calcula por ración.',
      createDish: 'Crear plato',
      servings: 'raciones',
      noDishesTitle: 'Aún no hay platos personales',
      noDishesText: 'Crea una receta propia con tus alimentos y cantidades.',
    },
    recipes: {
      eyebrow: 'Ideas flexibles, sin reglas rígidas',
      title: 'Recetas',
      subtitle: 'Las recetas iniciales calculan sus macros con alimentos BEDCA/AESAN. Se indica si los ingredientes se pesan crudos o cocinados.',
      viewFoods: 'Ver alimentos',
      refineEyebrow: 'Afinar ideas',
      favRecipes: 'Mis recetas favoritas',
      favFoodsBased: 'Basadas en alimentos favoritos',
      onlyPantry: 'Solo con lo que tengo',
      fitsMacros: 'Encaja en mis macros restantes',
      markAvailable: 'Marca los ingredientes disponibles',
      maxTime: 'Tiempo máximo (minutos)',
      noLimit: 'Sin límite',
      maxBudget: 'Presupuesto máximo por ración (€)',
      excludeFoods: 'Excluir alimentos',
      logBtn: 'Registrar',
      noRecipesTitle: 'No hay recetas con esos filtros',
      noRecipesText: 'Prueba a quitar algún filtro o amplía el tiempo disponible.',
    },
    stats: {
      eyebrow: 'Una mirada sin juicios',
      title: 'Estadísticas',
      subtitle: 'Observa patrones con curiosidad; un registro incompleto también cuenta como información.',
      logWeight: 'Anotar peso',
      last7Days: 'Últimos 7 días',
      last30Days: 'Últimos 30 días',
      completeDays: 'Días con registro completo',
      completeDaysDesc: 'Días con desayuno, comida y cena anotados. No es una meta.',
      avgKcal: 'Media kcal / día registrado',
      avgMacros: 'Media de macros / día registrado',
      paceEyebrow: 'Ritmo de registro',
      energyPerDay: 'Energía por día',
      trendEyebrow: 'Tendencia personal',
      weightLogged: 'Peso registrado',
      noTrendTitle: 'Aún no hay tendencia',
      noTrendText: 'Anota dos o más mediciones cuando te resulte útil.',
    },
    profile: {
      eyebrow: 'Un punto de partida, no una etiqueta',
      title: 'Tu perfil',
      subtitle: 'Tu información se sincroniza de forma privada con tu cuenta. Puedes cambiarla o borrarla cuando quieras.',
      estimateTitle: 'Datos para estimar',
      estimateDesc: 'Usamos Mifflin–St Jeor y un multiplicador de actividad. Son estimaciones, no consejo médico.',
      nameLabel: 'Cómo quieres que te llamemos',
      ageLabel: 'Edad',
      sexLabel: 'Sexo para fórmula',
      female: 'Mujer',
      male: 'Hombre',
      heightLabel: 'Altura (cm)',
      weightLabel: 'Peso actual (kg)',
      activityLabel: 'Actividad habitual',
      goalLabel: 'Objetivo',
      preferencesLabel: 'Preferencias alimentarias',
      avoidLabel: 'Alimentos que prefieres evitar',
      budgetLabel: 'Presupuesto orientativo por ración (€)',
      manualKcalLabel: 'Ajuste manual kcal/día',
      manualProteinLabel: 'Proteína objetivo (g/día)',
      manualCarbsLabel: 'Carbohidratos objetivo (g/día)',
      manualFatLabel: 'Grasas objetivo (g/día)',
      saveProfile: 'Guardar mi perfil',
      dailyRefEyebrow: 'Tu referencia diaria',
      personalEstimate: 'Estimación personal',
      bmr: 'Metabolismo basal',
      tdee: 'Gasto diario estimado',
      dailyGoal: 'Objetivo diario',
      remindersTitle: 'Recordatorios tranquilos',
      enableReminders: 'Activar recordatorios',
      saveTimes: 'Guardar horarios',
      accountEyebrow: 'Tu información, contigo',
      accountTitle: 'Cuenta, copia y privacidad',
      signOut: 'Cerrar sesión',
      exportJson: 'Exportar mis datos JSON',
      deleteData: 'Borrar mis datos personales',
      languageLabel: 'Idioma de la interfaz',
    },
  },
  en: {
    brand: 'mi nutrición',
    synced: 'Synced',
    loadingSpace: 'Loading your personal space…',
    nav: {
      today: 'Today',
      foods: 'Foods',
      recipes: 'Recipes',
      stats: 'Stats',
      profile: 'Profile',
    },
    today: {
      helloNamed: (name: string) => `Hi, ${name}`,
      helloGeneric: 'Hi, how are you feeling?',
      subtitle: 'Mindful tracking starts with what you have already done. No perfect days, no wasted days.',
      addLog: 'Add entry',
      yourWeek: 'Your week',
      prevWeek: 'Previous week',
      nextWeek: 'Next week',
      todayBtn: 'Today',
      loggedDaysLegend: 'Days with logged meals',
      reminderTitle: 'A mindful pause',
      reminderBody: 'Whenever it suits you, log something you ate. You can also leave it for later.',
      energyLogged: 'Energy logged',
      remainingKcal: (kcal: string) => `${kcal} kcal left toward your daily reference`,
      overKcal: (kcal: string) => `${kcal} kcal above your reference; this is an estimate, not a score.`,
      macros: 'Macronutrients',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
      yourDay: 'Your day, at your pace',
      mealLogTitle: 'Meal log',
      emptyLog: 'Your log is empty for now. Add foods whenever you want.',
      servingsUnit: 'servings',
      demoTag: 'Sample',
      ideaForToday: 'An idea for today',
      couldFit: 'Might fit your day',
      seeRecipes: 'See recipes',
      matchesPrefs: 'Matches your preferences',
      canFit: 'Fits macros',
      freeChoice: 'Free choice',
      addBtn: 'Add',
      noExactSuggestions: 'No exact suggestions right now',
      noExactSuggestionsText: 'Explore all recipes and choose freely.',
      compatibilityNote: 'Compatibility compares estimated macros per serving with your remaining daily reference; it guides rather than decides for you.',
      yourDishes: 'Your dishes',
      madeByYou: 'Made by you',
      yourDishPerServing: 'Your dish · per serving',
      collectionStartsHere: 'Your collection starts here',
      collectionStartsText: 'Create a custom dish in Foods to reuse it easily.',
      createFirstDish: 'Create a dish',
      disclaimer: 'Informational reference only, not medical advice. Adjust or disable your targets anytime in Profile.',
    },
    foods: {
      eyebrow: 'Your reference pantry',
      title: 'Foods',
      subtitle: 'Spanish BEDCA/AESAN composition catalog, clearly labeled samples, and personal foods synced to your account.',
      createFood: 'Create food',
      packagedEyebrow: 'Packaged products',
      offTitle: 'Search Open Food Facts',
      offDesc: 'Search by barcode. Community-contributed values may be incomplete or inaccurate; use as reference only. Only the barcode is sent.',
      barcodeLabel: 'Barcode (8–14 digits)',
      barcodePlaceholder: 'e.g. 3017620422003',
      searching: 'Searching…',
      searchProduct: 'Search product',
      viewSheet: 'View listing',
      reviewBeforeSave: 'Verify with package label before saving',
      searchPlaceholder: 'Search foods',
      showLabel: 'Show',
      categoryLabel: 'Category',
      filters: {
        all: 'All',
        bedca: 'BEDCA',
        favorites: 'Favorites',
        recent: 'Recent',
        mine: 'My foods',
        examples: 'Samples',
      },
      notFoundTitle: 'Food not found',
      notFoundText: 'Try another search term, change the filter, or create your own food.',
      dishesEyebrow: 'Your personal dishes',
      dishesTitle: 'Meals made your way',
      dishesSubtitle: 'Combine familiar foods and calculate nutrition per serving.',
      createDish: 'Create dish',
      servings: 'servings',
      noDishesTitle: 'No personal dishes yet',
      noDishesText: 'Create a custom recipe with your own foods and amounts.',
    },
    recipes: {
      eyebrow: 'Flexible ideas, no rigid rules',
      title: 'Recipes',
      subtitle: 'Starter recipes calculate macros using BEDCA/AESAN foods. Raw or cooked weights are specified per ingredient.',
      viewFoods: 'View foods',
      refineEyebrow: 'Refine ideas',
      favRecipes: 'My favorite recipes',
      favFoodsBased: 'Based on favorite foods',
      onlyPantry: 'Only with what I have',
      fitsMacros: 'Fits remaining macros',
      markAvailable: 'Select available ingredients',
      maxTime: 'Max prep time (minutes)',
      noLimit: 'No limit',
      maxBudget: 'Max budget per serving (€)',
      excludeFoods: 'Exclude foods',
      logBtn: 'Log',
      noRecipesTitle: 'No recipes match those filters',
      noRecipesText: 'Try removing a filter or increasing available time.',
    },
    stats: {
      eyebrow: 'A judgment-free look',
      title: 'Stats',
      subtitle: 'Observe patterns with curiosity; an incomplete log still counts as useful information.',
      logWeight: 'Log weight',
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      completeDays: 'Complete log days',
      completeDaysDesc: 'Days with breakfast, lunch, and dinner logged. Not a target.',
      avgKcal: 'Avg kcal / logged day',
      avgMacros: 'Avg macros / logged day',
      paceEyebrow: 'Logging rhythm',
      energyPerDay: 'Energy per day',
      trendEyebrow: 'Personal trend',
      weightLogged: 'Logged weight',
      noTrendTitle: 'No trend yet',
      noTrendText: 'Log two or more weigh-ins whenever helpful.',
    },
    profile: {
      eyebrow: 'A starting point, not a label',
      title: 'Your profile',
      subtitle: 'Your data syncs privately with your account. Edit or delete it anytime.',
      estimateTitle: 'Estimation inputs',
      estimateDesc: 'Uses Mifflin–St Jeor and an activity multiplier. Estimates only, not medical advice.',
      nameLabel: 'What should we call you?',
      ageLabel: 'Age',
      sexLabel: 'Formula sex',
      female: 'Female',
      male: 'Male',
      heightLabel: 'Height (cm)',
      weightLabel: 'Current weight (kg)',
      activityLabel: 'Usual activity',
      goalLabel: 'Goal',
      preferencesLabel: 'Dietary preferences',
      avoidLabel: 'Foods you prefer to avoid',
      budgetLabel: 'Reference budget per serving (€)',
      manualKcalLabel: 'Manual kcal/day override',
      manualProteinLabel: 'Target protein (g/day)',
      manualCarbsLabel: 'Target carbs (g/day)',
      manualFatLabel: 'Target fat (g/day)',
      saveProfile: 'Save my profile',
      dailyRefEyebrow: 'Your daily reference',
      personalEstimate: 'Personal estimate',
      bmr: 'Basal metabolic rate',
      tdee: 'Estimated daily expenditure',
      dailyGoal: 'Daily target',
      remindersTitle: 'Gentle reminders',
      enableReminders: 'Enable reminders',
      saveTimes: 'Save times',
      accountEyebrow: 'Your data stays yours',
      accountTitle: 'Account, backup & privacy',
      signOut: 'Sign out',
      exportJson: 'Export my JSON data',
      deleteData: 'Delete my personal data',
      languageLabel: 'Interface language',
    },
  },
} as const;

const foodNamesEn: Record<string, string> = {
  // Demo foods
  'demo-oats': 'Rolled oats',
  'demo-yogurt': 'Plain yogurt',
  'demo-banana': 'Banana',
  'demo-egg': 'Egg',
  'demo-tomato': 'Tomato',
  'demo-bread': 'Whole wheat bread',
  'demo-chicken': 'Chicken breast',
  'demo-rice': 'Cooked brown rice',
  'demo-spinach': 'Spinach',
  'demo-lentils': 'Cooked lentils',
  'demo-avocado': 'Avocado',
  'demo-olive': 'Olive oil',
  // BEDCA foods
  'bedca-1010': 'Oats, raw',
  'bedca-2245': 'Banana',
  'bedca-2126': 'Chicken egg, boiled, hard',
  'bedca-2421': 'Tomato',
  'bedca-2163': 'Whole wheat bread',
  'bedca-2297': 'Chicken, breast, grilled',
  'bedca-1009': 'Brown rice, boiled',
  'bedca-2395': 'Spinach, boiled',
  'bedca-1065': 'Lentils, dried, raw',
  'bedca-2216': 'Avocado',
  'bedca-2543': 'Olive oil',
  'bedca-2404': 'Potato, boiled',
  'bedca-2424': 'Carrot, raw',
  'bedca-1020': 'Chickpeas, dried, raw',
  'bedca-2520': 'Greek yogurt',
  'bedca-2376': 'Zucchini',
  'bedca-2407': 'Cucumber',
  'bedca-2507': 'Burgos fresh cheese',
  'bedca-2409': 'Red bell pepper, raw',
  'bedca-742': 'Tuna, baked',
  'bedca-731': 'Sweet potato, raw',
  'bedca-795': 'Cod, fresh, baked',
  'bedca-838': 'Monkfish, grilled',
  'bedca-896': 'Almonds, raw',
  'bedca-934': 'Fresh goat cheese',
  'bedca-953': 'Bulgarian yogurt',
  'bedca-961': 'Pork, tenderloin, roasted',
  'bedca-984': 'Beef, tenderloin, roasted',
  'bedca-990': 'Turkey, skinless breast, grilled',
  'bedca-1045': 'Frozen peas, boiled',
  'bedca-1072': 'Egg pasta, boiled',
  'bedca-1076': 'Whole wheat pasta, boiled',
  'bedca-1083': 'Quinoa, raw',
  'bedca-1121': 'Tofu',
  'bedca-1126': 'Lentils, canned',
  'bedca-1143': 'Enriched plain yogurt',
  'bedca-1172': 'Plum with skin, raw',
  'bedca-1173': 'Egg white, raw',
  'bedca-1176': 'Artichoke, raw',
  'bedca-1177': 'Broccoli, raw',
  'bedca-1179': 'Green asparagus',
  'bedca-1180': 'Brussels sprouts, raw',
  'bedca-1186': 'Mango, raw',
  'bedca-2133': 'Tuna, canned in water',
  'bedca-2193': 'Peas, canned',
  'bedca-2198': 'Green beans, raw',
  'bedca-2201': 'Walnut',
  'bedca-2220': 'Cherry',
  'bedca-2225': 'Strawberry',
  'bedca-2226': 'Pomegranate',
  'bedca-2228': 'Kiwi',
  'bedca-2333': 'Sea bream, grilled',
  'bedca-2344': 'Sea bass',
  'bedca-2347': 'Fresh hake',
  'bedca-2368': 'Blueberry',
  'bedca-2370': 'Eggplant',
  'bedca-2372': 'Broccoli, boiled',
  'bedca-2382': 'Onion, roasted',
  'bedca-2384': 'Mushroom',
  'bedca-2386': 'White cabbage, raw',
  'bedca-2387': 'Cauliflower, boiled',
  'bedca-2399': 'Lettuce',
  'bedca-2493': 'Cow milk, whole',
  'bedca-2510': 'Mozzarella cheese',
  'bedca-2517': 'Cottage / ricotta cheese',
  'bedca-2530': 'Skimmed plain yogurt',
  'bedca-2626': 'Salmon',
  'bedca-2627': 'Smoked salmon',
  'bedca-2631': 'Sardine, roasted',
  'bedca-2636': 'Trout',
};

const recipesEn: Record<string, { name: string; description: string }> = {
  'rec-oats': {
    name: 'Creamy oats with banana',
    description: 'A simple breakfast to fuel an active morning.',
  },
  'rec-toast': {
    name: 'Toast with egg and tomato',
    description: 'A warm, filling, and easy-to-prepare combination.',
  },
  'rec-bowl': {
    name: 'Chicken and rice bowl',
    description: 'Protein and energy in an everyday dish.',
  },
  'rec-lentils': {
    name: 'Lentils with spinach',
    description: 'A plant-based pantry staple for any day.',
  },
  'rec-avocado': {
    name: 'Green avocado toast',
    description: 'A fresh snack made with familiar ingredients.',
  },
  'bedca-recipe-oats-yogurt': {
    name: 'Oats with banana and Greek yogurt',
    description: 'Mix the oats and yogurt; top with banana. Weights correspond to ingredients before serving.',
  },
  'bedca-recipe-chicken-rice': {
    name: 'Brown rice with chicken and zucchini',
    description: 'Sauté the zucchini in olive oil and serve with boiled rice and grilled chicken breast. Rice and chicken are weighed cooked.',
  },
  'bedca-recipe-lentils': {
    name: 'Lentils with tomato and carrot',
    description: 'Simmer the lentils and vegetables until tender. Lentils are weighed dry before cooking; water is excluded from the calculation.',
  },
  'bedca-recipe-chickpeas': {
    name: 'Chickpeas with spinach and tomato',
    description: 'Cook the chickpeas and serve with spinach and tomato. Chickpeas are weighed dry before cooking; water is excluded from the calculation.',
  },
  'bedca-recipe-toast': {
    name: 'Whole wheat toast with avocado, tomato, and egg',
    description: 'Toast the bread and top with avocado, tomato, and boiled egg.',
  },
  'bedca-recipe-potato-egg': {
    name: 'Potato with egg and spinach',
    description: 'Combine boiled potato and egg with spinach; drizzle with olive oil when serving.',
  },
};

const tagEnMap: Record<string, string> = {
  Desayuno: 'Breakfast',
  Comida: 'Lunch',
  Cena: 'Dinner',
  Tentempié: 'Snack',
  Vegetariano: 'Vegetarian',
  Rápido: 'Quick',
  'Sin gluten': 'Gluten-free',
};

export function foodDisplayName(foodId: string, fallbackName: string, lang: Lang): string {
  if (lang !== 'en') return fallbackName;
  const cleanId = foodId.replace(/^(food|recipe|dish):/, '');
  return foodNamesEn[cleanId] ?? recipesEn[cleanId]?.name ?? fallbackName;
}

export function recipeDisplay(
  recipe: { id: string; name: string; description: string; tags: string[] },
  lang: Lang
): { name: string; description: string; tags: string[] } {
  if (lang !== 'en') return { name: recipe.name, description: recipe.description, tags: recipe.tags };
  const translated = recipesEn[recipe.id];
  return {
    name: translated?.name ?? recipe.name,
    description: translated?.description ?? recipe.description,
    tags: recipe.tags.map(tag => tagEnMap[tag] ?? tag),
  };
}