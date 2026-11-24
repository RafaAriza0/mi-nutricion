import type { Food, FoodCategory, Recipe } from './domain.ts';

// El cálculo 4/4/9 es orientativo: carbohidratos incluyen fibra y BEDCA puede
// usar factores específicos. Se acepta el mayor entre 30 kcal y un 25%.
export const ENERGY_MACRO_ABSOLUTE_TOLERANCE_KCAL = 30;
export const ENERGY_MACRO_RELATIVE_TOLERANCE = 0.25;

const nutrientFields = ['kcal', 'protein', 'carbs', 'fat'] as const;

export function validateBedcaCatalog(foods: readonly Food[], recipes: readonly Recipe[]): string[] {
  const errors: string[] = [];
  const foodIds = new Set<string>();

  for (const food of foods) {
    if (!/^bedca-\d+$/.test(food.id)) errors.push(`ID BEDCA no válido: «${food.id}».`);
    if (foodIds.has(food.id)) errors.push(`ID BEDCA duplicado: «${food.id}».`);
    foodIds.add(food.id);

    for (const field of nutrientFields) {
      const value = (food as unknown as Record<string, unknown>)[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`«${food.id}» no tiene un valor numérico finito para ${field}.`);
      } else if (value < 0) {
        errors.push(`«${food.id}» tiene un valor negativo para ${field}.`);
      }
    }

    const { protein, carbs, fat, kcal } = food;
    if ([protein, carbs, fat, kcal].every(value => Number.isFinite(value) && value >= 0)) {
      const macroKcal = 4 * protein + 4 * carbs + 9 * fat;
      const allowedDifference = Math.max(
        ENERGY_MACRO_ABSOLUTE_TOLERANCE_KCAL,
        macroKcal * ENERGY_MACRO_RELATIVE_TOLERANCE,
      );
      if (Math.abs(kcal - macroKcal) > allowedDifference) {
        errors.push(
          `«${food.id}» tiene energía incoherente: ${kcal} kcal frente a ${macroKcal.toFixed(1)} kcal estimadas (tolerancia ${allowedDifference.toFixed(1)} kcal/100 g).`,
        );
      }
    }
  }

  for (const recipe of recipes) {
    if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) {
      errors.push(`«${recipe.id}» debe tener un número de raciones positivo y finito.`);
    }

    const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const ingredient of recipe.ingredients) {
      const food = foods.find(candidate => candidate.id === ingredient.foodId);
      if (!food) {
        errors.push(`«${recipe.id}» referencia un alimento inexistente: «${ingredient.foodId}».`);
        continue;
      }
      if (!Number.isFinite(ingredient.grams) || ingredient.grams < 0) {
        errors.push(`«${recipe.id}» tiene una cantidad no válida para «${ingredient.foodId}».`);
        continue;
      }
      const factor = ingredient.grams / 100;
      total.kcal += food.kcal * factor;
      total.protein += food.protein * factor;
      total.carbs += food.carbs * factor;
      total.fat += food.fat * factor;
    }
    if (Object.values(total).some(value => !Number.isFinite(value))) {
      errors.push(`El cálculo nutricional de «${recipe.id}» no es finito.`);
    }
  }

  return errors;
}

export function assertValidBedcaCatalog(foods: readonly Food[], recipes: readonly Recipe[]): void {
  const errors = validateBedcaCatalog(foods, recipes);
  if (errors.length) throw new Error(`Catálogo BEDCA no válido:\n- ${errors.join('\n- ')}`);
}

const reviewed = '2026-10-16';
function categoryForBedcaFood(name: string): FoodCategory {
  const normalized=name.toLocaleLowerCase('es');
  if(/atún|bacalao|rape|dorada|lubina|merluza|salmón|sardina|trucha/.test(normalized))return 'Pescado';
  if(/pollo|cerdo|ternera|pavo/.test(normalized))return 'Carne';
  if(/queso|yogur|leche|requesón/.test(normalized))return 'Lácteos';
  if(/huevo/.test(normalized))return 'Huevos';
  if(/lenteja|garbanzo|guisante|judía/.test(normalized))return 'Legumbres';
  if(/avena|arroz|pan|pasta|quinoa/.test(normalized))return 'Cereales';
  if(/almendra|nuez/.test(normalized))return 'Frutos secos';
  if(/aceite/.test(normalized))return 'Aceites y grasas';
  if(/plátano|aguacate|ciruela|mango|cereza|fresa|granada|kiwi|arándano/.test(normalized))return 'Fruta';
  return 'Verdura';
}
const foodFromBedca = (recordId:number,name:string,energyKj:number,protein:number,carbs:number,fat:number):Food => ({
  id:`bedca-${recordId}`,name,unit:'g',gramsPerUnit:100,kcal:Number((energyKj/4.184).toFixed(1)),
  protein,carbs,fat,source:`BEDCA/AESAN · ficha ${recordId}`,reviewed,catalog:true,
});

// BEDCA/AESAN values per 100 g of edible portion. Energy in kJ is converted to kcal.
const bedcaFoodsWithoutCategories: Food[] = [
  {id:'bedca-1010',name:'Avena, cruda',unit:'g',gramsPerUnit:100,kcal:399.1,protein:16.9,carbs:66.3,fat:6.9,source:'BEDCA/AESAN · ficha 1010',reviewed,catalog:true},
  {id:'bedca-2245',name:'Plátano',unit:'g',gramsPerUnit:100,kcal:88.8,protein:1.2,carbs:20,fat:0.3,source:'BEDCA/AESAN · ficha 2245',reviewed,catalog:true},
  {id:'bedca-2126',name:'Huevo de gallina, hervido, duro',unit:'g',gramsPerUnit:100,kcal:144.9,protein:12.5,carbs:0.3,fat:10.5,source:'BEDCA/AESAN · ficha 2126',reviewed,catalog:true},
  {id:'bedca-2421',name:'Tomate',unit:'g',gramsPerUnit:100,kcal:18.8,protein:0.9,carbs:3.5,fat:0.1,source:'BEDCA/AESAN · ficha 2421',reviewed,catalog:true},
  {id:'bedca-2163',name:'Pan integral',unit:'g',gramsPerUnit:100,kcal:249.6,protein:10.9,carbs:44,fat:3,source:'BEDCA/AESAN · ficha 2163',reviewed,catalog:true},
  {id:'bedca-2297',name:'Pollo, pechuga, plancha',unit:'g',gramsPerUnit:100,kcal:145,protein:22.2,carbs:0,fat:6.2,source:'BEDCA/AESAN · ficha 2297',reviewed,catalog:true},
  {id:'bedca-1009',name:'Arroz integral, hervido',unit:'g',gramsPerUnit:100,kcal:111.6,protein:2.6,carbs:22.9,fat:0.9,source:'BEDCA/AESAN · ficha 1009',reviewed,catalog:true},
  {id:'bedca-2395',name:'Espinaca, hervida',unit:'g',gramsPerUnit:100,kcal:21.9,protein:2.39,carbs:1.94,fat:0.49,source:'BEDCA/AESAN · ficha 2395',reviewed,catalog:true},
  {id:'bedca-1065',name:'Lenteja, seca, cruda',unit:'g',gramsPerUnit:100,kcal:308.9,protein:24.7674,carbs:48.6954,fat:1.17286,source:'BEDCA/AESAN · ficha 1065',reviewed,catalog:true},
  {id:'bedca-2216',name:'Aguacate',unit:'g',gramsPerUnit:100,kcal:136.2,protein:1.5,carbs:0.4,fat:12,source:'BEDCA/AESAN · ficha 2216',reviewed,catalog:true},
  {id:'bedca-2543',name:'Aceite de oliva',unit:'g',gramsPerUnit:100,kcal:883.4,protein:0,carbs:0,fat:99.9,source:'BEDCA/AESAN · ficha 2543',reviewed,catalog:true},
  {id:'bedca-2404',name:'Patata, hervida',unit:'g',gramsPerUnit:100,kcal:74.9,protein:2.38,carbs:15.62,fat:0.2,source:'BEDCA/AESAN · ficha 2404',reviewed,catalog:true},
  {id:'bedca-2424',name:'Zanahoria, cruda',unit:'g',gramsPerUnit:100,kcal:34.3,protein:0.8,carbs:7,fat:0.3,source:'BEDCA/AESAN · ficha 2424',reviewed,catalog:true},
  {id:'bedca-1020',name:'Garbanzo, seco, crudo',unit:'g',gramsPerUnit:100,kcal:334.2,protein:19.305,carbs:49.2463,fat:6.3,source:'BEDCA/AESAN · ficha 1020',reviewed,catalog:true},
  {id:'bedca-2520',name:'Yogur griego',unit:'g',gramsPerUnit:100,kcal:138.1,protein:6.4,carbs:5.4,fat:10.2,source:'BEDCA/AESAN · ficha 2520',reviewed,catalog:true},
  {id:'bedca-2376',name:'Calabacín',unit:'g',gramsPerUnit:100,kcal:17.2,protein:1.8,carbs:2,fat:0.2,source:'BEDCA/AESAN · ficha 2376',reviewed,catalog:true},
  {id:'bedca-2407',name:'Pepino',unit:'g',gramsPerUnit:100,kcal:11.9,protein:0.7,carbs:2,fat:0.1,source:'BEDCA/AESAN · ficha 2407',reviewed,catalog:true},
  {id:'bedca-2507',name:'Queso fresco de Burgos',unit:'g',gramsPerUnit:100,kcal:196.7,protein:12.4,carbs:2.5,fat:15.4,source:'BEDCA/AESAN · ficha 2507',reviewed,catalog:true},
  {id:'bedca-2409',name:'Pimiento rojo, crudo',unit:'g',gramsPerUnit:100,kcal:28.9,protein:1.3,carbs:4.5,fat:0.6,source:'BEDCA/AESAN · ficha 2409',reviewed,catalog:true},
  // Ampliación del catálogo: solo fichas con energía y los tres macros disponibles.
  foodFromBedca(742,'Atún, al horno',791.689,29.4,0,7.88889),
  foodFromBedca(731,'Boniato, crudo',422.5,1.2,23,0.3),
  foodFromBedca(795,'Bacalao, fresco, al horno',414.814,22.1,0,1.05714),
  foodFromBedca(838,'Rape, a la parrilla',396.2,22,0,0.6),
  foodFromBedca(896,'Almendra, cruda',2452.6,19.1333,6.2038,45.22),
  foodFromBedca(934,'Queso fresco de cabra',1240.83,19.8,1.1,23.9333),
  foodFromBedca(953,'Yogur búlgaro',309.4,5,5.8,3.4),
  foodFromBedca(961,'Cerdo, solomillo, asado',663.535,28.8,0,4.70094),
  foodFromBedca(984,'Ternera, solomillo, asado',654.406,28.4,0,4.63799),
  foodFromBedca(990,'Pavo, pechuga sin piel, a la plancha',606.183,29.9,0,2.6455),
  foodFromBedca(1045,'Guisante congelado, hervido',252.5,6,6.89409,0.9),
  foodFromBedca(1072,'Pasta con huevo, hervida',524.424,4.7,22.9,1.49254),
  foodFromBedca(1076,'Pasta integral, hervida',507.6,4.7,23.2,0.9),
  foodFromBedca(1083,'Quinoa, cruda',1276.47,13.8,49.195,5.55555),
  foodFromBedca(1121,'Tofu',496.725,11.5,3.3,6.625),
  foodFromBedca(1126,'Lenteja, en conserva',308.33,6.28,11.4,0.21),
  foodFromBedca(1143,'Yogur enriquecido, natural',265,3.2,3.9,3.9),
  foodFromBedca(1172,'Ciruela con piel, cruda',224.15,0.75,12,0.2),
  foodFromBedca(1173,'Clara de huevo, cruda',187.3,10.5,0.3,0.1),
  foodFromBedca(1176,'Alcachofa, cruda',95.12,2.9,2.26,0.2),
  foodFromBedca(1177,'Brécol (brócoli), crudo',106.6,3,2.4,0.4),
  foodFromBedca(1179,'Espárrago verde',105.5,2.9,2,0.6),
  foodFromBedca(1180,'Col de Bruselas, cruda',146,4,3.5,0.5),
  foodFromBedca(1186,'Mango, crudo',245.4,0.6,13.4,0.2),
  foodFromBedca(2133,'Atún, al natural',421.7,23.5,0,0.6),
  foodFromBedca(2193,'Guisantes en conserva',278.6,5.6,9.7,0.5),
  foodFromBedca(2198,'Judía verde, cruda',115.1,2.2,3.7,0.4),
  foodFromBedca(2201,'Nuez',2477.1,14,3.3,63.28),
  foodFromBedca(2220,'Cereza',261.6,0.8,13.5,0.5),
  foodFromBedca(2225,'Fresa',149.4,0.7,7,0.5),
  foodFromBedca(2226,'Granada',261,1,13.7,0.3),
  foodFromBedca(2228,'Kiwi',217.4,1.1,10.6,0.5),
  foodFromBedca(2333,'Dorada, a la plancha',388.9,17,0,2.7),
  foodFromBedca(2344,'Lubina',354.1,18,0,1.3),
  foodFromBedca(2347,'Merluza fresca',269.41,11.93,0,1.8),
  foodFromBedca(2368,'Arándano',135.675,0.625,6.05,0.6),
  foodFromBedca(2370,'Berenjena',83.9,0.7,3.8,0.2),
  foodFromBedca(2372,'Brécol (brócoli), hervido',101,3.1,1.1,0.8),
  foodFromBedca(2382,'Cebolla, asada',158.87,1.17,7.74,0.2),
  foodFromBedca(2384,'Champiñón',109.7,1.8,4,0.3),
  foodFromBedca(2386,'Col blanca, cruda',149.58,4.3,2.54,0.9),
  foodFromBedca(2387,'Coliflor, hervida',113.79,2.76,2.04,0.87),
  foodFromBedca(2399,'Lechuga',65.125,1.125,1.4,0.6),
  foodFromBedca(2493,'Leche de vaca, entera',272.52,3.06,4.7,3.8),
  foodFromBedca(2510,'Queso mozzarella',927.2,19.5,0,16.1),
  foodFromBedca(2517,'Requesón',424.47,12.31,3.3,4.3),
  foodFromBedca(2530,'Yogur desnatado, natural',192.04,4.3,6.3,0.32),
  foodFromBedca(2626,'Salmón',756.8,18.4,0,12),
  foodFromBedca(2627,'Salmón ahumado',753.7,25.4,0,8.7),
  foodFromBedca(2631,'Sardina, asada',1067.79,16.67,0,21.2),
  foodFromBedca(2636,'Trucha',377.9,15.7,0,3),
];
export const bedcaFoods: Food[] = bedcaFoodsWithoutCategories.map(food=>({...food,category:categoryForBedcaFood(food.name)}));

export const bedcaRecipes: Recipe[] = [
  {
    id:'bedca-recipe-oats-yogurt',
    name:'Avena con plátano y yogur griego',
    description:'Mezcla la avena y el yogur; añade el plátano. Los pesos corresponden a los ingredientes antes de servir.',
    ingredients:[{foodId:'bedca-1010',grams:40},{foodId:'bedca-2520',grams:125},{foodId:'bedca-2245',grams:60}],
    servings:1,minutes:8,tags:['Desayuno','Vegetariano'],
  },
  {
    id:'bedca-recipe-chicken-rice',
    name:'Arroz integral con pollo y calabacín',
    description:'Saltea el calabacín con el aceite y sirve con arroz hervido y pechuga a la plancha. Arroz y pollo se pesan cocinados.',
    ingredients:[{foodId:'bedca-1009',grams:150},{foodId:'bedca-2297',grams:120},{foodId:'bedca-2376',grams:100},{foodId:'bedca-2543',grams:5}],
    servings:1,minutes:20,tags:['Comida','Sin gluten'],
  },
  {
    id:'bedca-recipe-lentils',
    name:'Lentejas con tomate y zanahoria',
    description:'Cuece las lentejas y las verduras hasta que estén tiernas. Las lentejas se pesan secas antes de cocer; el agua no se incluye en el cálculo.',
    ingredients:[{foodId:'bedca-1065',grams:60},{foodId:'bedca-2421',grams:100},{foodId:'bedca-2424',grams:60},{foodId:'bedca-2543',grams:5}],
    servings:1,minutes:35,tags:['Comida','Vegetariano'],
  },
  {
    id:'bedca-recipe-chickpeas',
    name:'Garbanzos con espinacas y tomate',
    description:'Cuece los garbanzos y sírvelos con espinacas y tomate. Los garbanzos se pesan secos antes de cocer; el agua no se incluye en el cálculo.',
    ingredients:[{foodId:'bedca-1020',grams:60},{foodId:'bedca-2395',grams:80},{foodId:'bedca-2421',grams:100},{foodId:'bedca-2543',grams:5}],
    servings:1,minutes:40,tags:['Comida','Vegetariano'],
  },
  {
    id:'bedca-recipe-toast',
    name:'Tostada integral con aguacate, tomate y huevo',
    description:'Tuesta el pan y acompáñalo con aguacate, tomate y huevo cocido.',
    ingredients:[{foodId:'bedca-2163',grams:70},{foodId:'bedca-2216',grams:45},{foodId:'bedca-2421',grams:60},{foodId:'bedca-2126',grams:55}],
    servings:1,minutes:12,tags:['Desayuno','Vegetariano'],
  },
  {
    id:'bedca-recipe-potato-egg',
    name:'Patata con huevo y espinacas',
    description:'Combina patata y huevo cocidos con espinacas; añade el aceite al servir.',
    ingredients:[{foodId:'bedca-2404',grams:180},{foodId:'bedca-2126',grams:55},{foodId:'bedca-2395',grams:80},{foodId:'bedca-2543',grams:5}],
    servings:1,minutes:18,tags:['Comida','Sin gluten'],
  },
];

assertValidBedcaCatalog(bedcaFoods, bedcaRecipes);
