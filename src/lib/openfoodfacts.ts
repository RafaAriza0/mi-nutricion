type ApiProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
};

type ApiResponse = { status?: number; product?: ApiProduct };

export type OpenFoodFactsProduct = {
  code: string;
  name: string;
  brands: string;
  quantity: string;
  nutritionDataPer: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

function readNonNegativeNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function lookupOpenFoodFactsProduct(barcode: string): Promise<OpenFoodFactsProduct | null> {
  if (!/^\d{8,14}$/.test(barcode)) throw new Error('Introduce un código de barras de 8 a 14 cifras.');

  const url = new URL(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json`);
  url.searchParams.set('fields', 'code,product_name,brands,quantity,nutrition_data_per,nutriments');
  const response = await fetch(url, { headers: { 'X-User-Agent': 'MiNutricion personal nutrition app' } });
  if (!response.ok) throw new Error('Open Food Facts no está disponible ahora. Inténtalo de nuevo más tarde.');

  const result = await response.json() as ApiResponse;
  if (result.status !== 1 || !result.product) return null;

  const product = result.product;
  const nutrients = product.nutriments ?? {};
  const kcalFromLabel = readNonNegativeNumber(nutrients['energy-kcal_100g']);
  const energyKj = readNonNegativeNumber(nutrients['energy-kj_100g']);
  return {
    code: product.code?.trim() || barcode,
    name: product.product_name?.trim() ?? '',
    brands: product.brands?.trim() ?? '',
    quantity: product.quantity?.trim() ?? '',
    nutritionDataPer: product.nutrition_data_per?.trim() || '100 g',
    kcal: kcalFromLabel ?? (energyKj === null ? null : energyKj / 4.184),
    protein: readNonNegativeNumber(nutrients.proteins_100g),
    carbs: readNonNegativeNumber(nutrients.carbohydrates_100g),
    fat: readNonNegativeNumber(nutrients.fat_100g),
  };
}
