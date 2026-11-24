export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };
export const foodCategories = ['Fruta', 'Verdura', 'Cereales', 'Legumbres', 'Lácteos', 'Carne', 'Pescado', 'Huevos', 'Frutos secos', 'Aceites y grasas', 'Otros'] as const;
export type FoodCategory = typeof foodCategories[number];
export type Food = Nutrients & { id: string; name: string; unit: string; gramsPerUnit: number; category?: FoodCategory; barcode?: string; source: string; reviewed: string; demo?: boolean; catalog?: boolean };
export const foodMatchesCategory = (food: Pick<Food, 'category'>, category: FoodCategory | 'Todas') => category === 'Todas' || (food.category ?? 'Otros') === category;
export type Meal = 'Desayuno' | 'Comida' | 'Cena' | 'Tentempié';
export type LogEntry = { id: string; foodId: string; name: string; date: string; meal: Meal; amount: number; unit: 'g' | 'ud'; grams: number; nutrients: Nutrients; demo?: boolean };
export type Ingredient = { foodId: string; grams: number };
export type Dish = { id: string; name: string; description: string; ingredients: Ingredient[]; servings: number; notes: string; tags: string[]; photo?: string; cost?: number };
export type Recipe = { id: string; name: string; description: string; ingredients: Ingredient[]; servings: number; minutes: number; cost?: number; tags: string[]; demo?: boolean };
export type Profile = { name: string; age: number; sex: 'mujer' | 'hombre'; height: number; weight: number; activity: number; goal: 'maintain' | 'lose' | 'gain'; pace: number; preferences: string; avoid: string; budget: number | null; manualCalories: number | null; manualProtein: number | null; manualCarbs: number | null; manualFat: number | null };
export type WeightEntry = { id: string; date: string; weight: number; note: string };
export type Reminder = { enabled: boolean; times: string[] };
export type Store = { profile: Profile | null; foods: Food[]; logs: LogEntry[]; dishes: Dish[]; favorites: string[]; recipeFavorites: string[]; recent: string[]; weights: WeightEntry[]; reminder: Reminder };
export const today = () => { const date=new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
export function shiftDate(dateKey:string,days:number) {
 const [year,month,day]=dateKey.split('-').map(Number), date=new Date(year,month-1,day,12);
 date.setDate(date.getDate()+days);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weekDateKeys(dateKey:string) {
 const [year,month,day]=dateKey.split('-').map(Number), monday=new Date(year,month-1,day,12);
 monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 return Array.from({length:7},(_,index)=>shiftDate(`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`,index));
}
export function weekLoggedDateKeys(logs:Pick<LogEntry,'date'>[],dateKey:string):Set<string> {
 const visibleDates=new Set(weekDateKeys(dateKey));
 return new Set(logs.map(log=>log.date).filter(key=>visibleDates.has(key)));
}
export const mealNames: Meal[] = ['Desayuno', 'Comida', 'Cena', 'Tentempié'];
export const demoFoods: Food[] = [
 {id:'demo-oats',name:'Copos de avena',unit:'ración',gramsPerUnit:40,kcal:389,protein:16.9,carbs:66.3,fat:6.9,category:'Cereales',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-yogurt',name:'Yogur natural',unit:'unidad',gramsPerUnit:125,kcal:61,protein:3.5,carbs:4.7,fat:3.3,category:'Lácteos',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-banana',name:'Plátano',unit:'unidad',gramsPerUnit:120,kcal:89,protein:1.1,carbs:22.8,fat:.3,category:'Fruta',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-egg',name:'Huevo',unit:'unidad',gramsPerUnit:60,kcal:143,protein:12.6,carbs:.7,fat:9.5,category:'Huevos',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-tomato',name:'Tomate',unit:'g',gramsPerUnit:100,kcal:18,protein:.9,carbs:3.9,fat:.2,category:'Verdura',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-bread',name:'Pan integral',unit:'rebanada',gramsPerUnit:35,kcal:247,protein:13,carbs:41,fat:4.2,category:'Cereales',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-chicken',name:'Pechuga de pollo',unit:'g',gramsPerUnit:100,kcal:165,protein:31,carbs:0,fat:3.6,category:'Carne',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-rice',name:'Arroz integral cocido',unit:'g',gramsPerUnit:100,kcal:123,protein:2.7,carbs:25.6,fat:1,category:'Cereales',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-spinach',name:'Espinacas',unit:'g',gramsPerUnit:100,kcal:23,protein:2.9,carbs:3.6,fat:.4,category:'Verdura',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-lentils',name:'Lentejas cocidas',unit:'g',gramsPerUnit:100,kcal:116,protein:9,carbs:20.1,fat:.4,category:'Legumbres',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-avocado',name:'Aguacate',unit:'g',gramsPerUnit:100,kcal:160,protein:2,carbs:8.5,fat:14.7,category:'Fruta',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
 {id:'demo-olive',name:'Aceite de oliva',unit:'cucharadita',gramsPerUnit:5,kcal:884,protein:0,carbs:0,fat:100,category:'Aceites y grasas',source:'Ejemplo orientativo',reviewed:'2025-01-01',demo:true},
];
export const demoRecipes: Recipe[] = [
  {id:'rec-oats',name:'Avena cremosa con plátano',description:'Un desayuno sencillo que acompaña una mañana activa.',ingredients:[{foodId:'demo-oats',grams:40},{foodId:'demo-yogurt',grams:125},{foodId:'demo-banana',grams:60}],servings:1,minutes:8,cost:1.35,tags:['Desayuno','Vegetariano'],demo:true},
  {id:'rec-toast',name:'Tostada con huevo y tomate',description:'Una combinación cálida, saciante y fácil de preparar.',ingredients:[{foodId:'demo-bread',grams:70},{foodId:'demo-egg',grams:60},{foodId:'demo-tomato',grams:100}],servings:1,minutes:12,cost:1.6,tags:['Desayuno','Rápido'],demo:true},
  {id:'rec-bowl',name:'Bowl de pollo y arroz',description:'Proteína y energía en un plato de diario.',ingredients:[{foodId:'demo-chicken',grams:100},{foodId:'demo-rice',grams:130},{foodId:'demo-spinach',grams:50},{foodId:'demo-olive',grams:5}],servings:1,minutes:20,cost:2.8,tags:['Comida','Sin gluten'],demo:true},
  {id:'rec-lentils',name:'Lentejas con espinacas',description:'Una idea vegetal de despensa para cualquier día.',ingredients:[{foodId:'demo-lentils',grams:180},{foodId:'demo-spinach',grams:70},{foodId:'demo-tomato',grams:80}],servings:1,minutes:22,cost:1.9,tags:['Vegetariano','Comida'],demo:true},
  {id:'rec-avocado',name:'Tostada verde con aguacate',description:'Un tentempié fresco con ingredientes conocidos.',ingredients:[{foodId:'demo-bread',grams:35},{foodId:'demo-avocado',grams:45},{foodId:'demo-tomato',grams:50}],servings:1,minutes:7,cost:1.25,tags:['Rápido','Vegetariano'],demo:true},
];
export const blankProfile: Profile = {name:'',age:30,sex:'mujer',height:165,weight:65,activity:1.45,goal:'maintain',pace:.25,preferences:'',avoid:'',budget:null,manualCalories:null,manualProtein:null,manualCarbs:null,manualFat:null};
export function emptyStore(): Store { return {profile:null,foods:[],logs:[],dishes:[],favorites:[],recipeFavorites:[],recent:[],weights:[],reminder:{enabled:false,times:['09:00','13:00','20:00']}}; }
export const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export function foodById(foodId:string, foods:Food[]) { return foods.find(f=>f.id===foodId) ?? demoFoods.find(f=>f.id===foodId); }
export function scaled(food: Nutrients, grams:number): Nutrients { const factor=grams/100; return {kcal:food.kcal*factor,protein:food.protein*factor,carbs:food.carbs*factor,fat:food.fat*factor}; }
export function addNutrients(a:Nutrients,b:Nutrients):Nutrients { return {kcal:a.kcal+b.kcal,protein:a.protein+b.protein,carbs:a.carbs+b.carbs,fat:a.fat+b.fat}; }
export function multiplyNutrients(n:Nutrients,factor:number):Nutrients { return {kcal:n.kcal*factor,protein:n.protein*factor,carbs:n.carbs*factor,fat:n.fat*factor}; }
export function nutrientsPerServing(entry:Pick<LogEntry,'amount'|'nutrients'>):Nutrients {
 const servings=Number.isFinite(entry.amount)&&entry.amount>0?entry.amount:1;
 return multiplyNutrients(entry.nutrients,1/servings);
}
export function sumLogs(logs:LogEntry[]) { return logs.reduce((a,l)=>addNutrients(a,l.nutrients),{kcal:0,protein:0,carbs:0,fat:0}); }
export function moveLogEntry(logs:LogEntry[],logId:string,meal:Meal):LogEntry[] {
 return logs.map(entry=>entry.id===logId?{...entry,meal}:entry);
}
function preferenceTerms(value:string) {
 return value.split(/[,;\n]+/).map(term=>term.trim().toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu,'')).filter(Boolean);
}
function recipeSearchText(recipe:Pick<Recipe,'name'|'description'|'tags'|'ingredients'>,foods:Food[]) {
 return [recipe.name,recipe.description,...recipe.tags,...recipe.ingredients.map(ingredient=>foodById(ingredient.foodId,foods)?.name??'')]
  .join(' ').toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu,'');
}
export function recipePreferenceScore(recipe:Pick<Recipe,'name'|'description'|'tags'|'ingredients'>,foods:Food[],preferences:string) {
 const text=recipeSearchText(recipe,foods);
 return preferenceTerms(preferences).filter(term=>text.includes(term)).length;
}
export function recipeMatchesAvoidance(recipe:Pick<Recipe,'name'|'description'|'tags'|'ingredients'>,foods:Food[],avoid:string) {
 const text=recipeSearchText(recipe,foods);
 return preferenceTerms(avoid).some(term=>text.includes(term));
}
export function recipeNutrition(recipe:Pick<Recipe,'ingredients'|'servings'>,foods:Food[]):Nutrients {
 if(!Number.isFinite(recipe.servings)||recipe.servings<=0) throw new Error('La receta debe tener un número de raciones positivo y finito.');
 const total=recipe.ingredients.reduce((a,i)=>{
  if(!Number.isFinite(i.grams)||i.grams<0) throw new Error(`La cantidad del ingrediente «${i.foodId}» debe ser finita y no negativa.`);
  const f=foodById(i.foodId,foods);
  if(!f) throw new Error(`No existe el alimento «${i.foodId}» de la receta.`);
  return addNutrients(a,scaled(f,i.grams));
 },{kcal:0,protein:0,carbs:0,fat:0});
 if(Object.values(total).some(value=>!Number.isFinite(value))) throw new Error(`El cálculo nutricional de la receta «${recipe.ingredients.map(i=>i.foodId).join(', ')}» no es finito.`);
 return total;
}
export function targets(profile:Profile|null) {
 if(!profile) return {bmr:0,tdee:0,calories:2000,protein:100,carbs:250,fat:67};
 const base=10*profile.weight+6.25*profile.height-5*profile.age+(profile.sex==='hombre'?5:-161), tdee=base*profile.activity;
 const adjustment=profile.goal==='lose'?-Math.min(500,Math.max(150,profile.pace*7700/7)):profile.goal==='gain'?Math.min(300,Math.max(100,profile.pace*7700/7)):0;
 const minimum=profile.sex==='mujer'?1200:1500;
 const calories=Math.max(minimum,Math.min(5000,profile.manualCalories??Math.round(tdee+adjustment)));
 const protein=Number.isFinite(profile.manualProtein)?profile.manualProtein!:Math.round(profile.weight*(profile.goal==='gain'?1.7:1.5));
 const fat=Number.isFinite(profile.manualFat)?profile.manualFat!:Math.round(calories*.28/9);
 const carbs=Number.isFinite(profile.manualCarbs)?profile.manualCarbs!:Math.round((calories-protein*4-fat*9)/4);
 return {bmr:Math.round(base),tdee:Math.round(tdee),calories,protein,fat,carbs};
}
export function recipeFit(n:Nutrients, remaining:Nutrients) { return n.kcal<=remaining.kcal+35 && n.protein<=remaining.protein+20 && n.carbs<=remaining.carbs+30 && n.fat<=remaining.fat+15; }
