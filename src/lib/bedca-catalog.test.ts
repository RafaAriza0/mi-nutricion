import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidBedcaCatalog,
  bedcaFoods,
  bedcaRecipes,
  ENERGY_MACRO_ABSOLUTE_TOLERANCE_KCAL,
  ENERGY_MACRO_RELATIVE_TOLERANCE,
} from './bedca-catalog.ts';
import { recipeNutrition, type Food, type Recipe } from './domain.ts';

const validFood = bedcaFoods[0];
const validRecipe: Recipe = {
  id: 'bedca-recipe-test',
  name: 'Prueba',
  description: '',
  ingredients: [{ foodId: validFood.id, grams: 50 }],
  servings: 1,
  minutes: 1,
  tags: [],
};

test('el catálogo BEDCA actual tiene IDs únicos, valores completos y recetas válidas', () => {
  assertValidBedcaCatalog(bedcaFoods, bedcaRecipes);
  assert.equal(new Set(bedcaFoods.map(food => food.id)).size, bedcaFoods.length);
});

test('rechaza IDs BEDCA duplicados', () => {
  assert.throws(
    () => assertValidBedcaCatalog([validFood, { ...validFood }], []),
    /ID BEDCA duplicado/,
  );
});

test('rechaza nutrientes ausentes, no finitos o negativos', () => {
  const incomplete = { ...validFood, protein: undefined } as unknown as Food;
  const negative = { ...validFood, fat: -1 };
  const infinite = { ...validFood, kcal: Number.POSITIVE_INFINITY };

  assert.throws(() => assertValidBedcaCatalog([incomplete], []), /protein/);
  assert.throws(() => assertValidBedcaCatalog([negative], []), /negativo para fat/);
  assert.throws(() => assertValidBedcaCatalog([infinite], []), /finito para kcal/);
});

test('aplica una tolerancia energética explícita y detecta incoherencias claras', () => {
  assert.equal(ENERGY_MACRO_ABSOLUTE_TOLERANCE_KCAL, 30);
  assert.equal(ENERGY_MACRO_RELATIVE_TOLERANCE, 0.25);
  const withinTolerance = { ...validFood, kcal: 400, protein: 10, carbs: 50, fat: 10 };
  const outsideTolerance = { ...withinTolerance, kcal: 900 };

  assert.deepEqual(assertValidBedcaCatalog([withinTolerance], []), undefined);
  assert.throws(() => assertValidBedcaCatalog([outsideTolerance], []), /energía incoherente/);
});

test('rechaza recetas con referencias ausentes, cantidades inválidas o raciones no válidas', () => {
  assert.throws(
    () => assertValidBedcaCatalog([validFood], [{ ...validRecipe, ingredients: [{ foodId: 'bedca-999999', grams: 5 }] }]),
    /alimento inexistente/,
  );
  assert.throws(
    () => assertValidBedcaCatalog([validFood], [{ ...validRecipe, ingredients: [{ foodId: validFood.id, grams: Number.NaN }] }]),
    /cantidad no válida/,
  );
  assert.throws(
    () => assertValidBedcaCatalog([validFood], [{ ...validRecipe, servings: 0 }]),
    /raciones positivo y finito/,
  );
});

test('recipeNutrition no omite ingredientes ni devuelve cálculos no finitos', () => {
  assert.throws(
    () => recipeNutrition({ ...validRecipe, ingredients: [{ foodId: 'bedca-missing', grams: 10 }] }, [validFood]),
    /No existe el alimento/,
  );
  assert.throws(
    () => recipeNutrition({ ...validRecipe, ingredients: [{ foodId: validFood.id, grams: Number.POSITIVE_INFINITY }] }, [validFood]),
    /debe ser finita y no negativa/,
  );
  assert.throws(
    () => recipeNutrition({ ...validRecipe, servings: Number.NaN }, [validFood]),
    /raciones positivo y finito/,
  );
});
