import assert from 'node:assert/strict';
import test from 'node:test';
import { moveLogEntry, multiplyNutrients, nutrientsPerServing, recipeMatchesAvoidance, recipePreferenceScore, type Food, type LogEntry, type Recipe } from './domain.ts';

const foods: Food[] = [{
 id:'lentils',name:'Lentejas cocidas',unit:'g',gramsPerUnit:100,kcal:116,protein:9,carbs:20.1,fat:.4,source:'Prueba',reviewed:'2026-10-16',
}];
const recipe: Recipe = {
 id:'bowl',name:'Bowl vegetal',description:'Una idea sencilla',ingredients:[{foodId:'lentils',grams:150}],servings:1,minutes:15,tags:['Vegetariano','Sin gluten'],
};

test('la puntuación de preferencias usa nombre, etiquetas e ingredientes sin distinguir tildes',()=>{
 assert.equal(recipePreferenceScore(recipe,foods,'vegetariano, lentejas'),2);
 assert.equal(recipePreferenceScore(recipe,foods,'pescado'),0);
});

test('las exclusiones se aplican a ingredientes y etiquetas de una receta',()=>{
 assert.equal(recipeMatchesAvoidance(recipe,foods,'lentejas'),true);
 assert.equal(recipeMatchesAvoidance(recipe,foods,'sin gluten'),true);
 assert.equal(recipeMatchesAvoidance(recipe,foods,'cacahuetes'),false);
});

test('una repetición calcula una ración desde la información guardada, sin consultar la receta actual',()=>{
 const historicEntry: LogEntry = {
  id:'old-log',foodId:'recipe:removed-recipe',name:'Receta retirada',date:'2026-10-15',meal:'Cena',amount:2,unit:'ud',grams:0,
  nutrients:{kcal:760,protein:36,carbs:92,fat:24},
 };
 const perServing=nutrientsPerServing(historicEntry);
 assert.deepEqual(perServing,{kcal:380,protein:18,carbs:46,fat:12});
 assert.deepEqual(multiplyNutrients(perServing,1.5),{kcal:570,protein:27,carbs:69,fat:18});
});

test('mover un alimento, plato o receta solo cambia la comida asignada',()=>{
 const entries:LogEntry[]=[
  {id:'food-log',foodId:'lentils',name:'Lentejas',date:'2026-10-15',meal:'Desayuno',amount:150,unit:'g',grams:150,nutrients:{kcal:174,protein:13.5,carbs:30.15,fat:.6}},
  {id:'dish-log',foodId:'dish:plato',name:'Plato',date:'2026-10-14',meal:'Comida',amount:2,unit:'ud',grams:0,nutrients:{kcal:500,protein:22,carbs:60,fat:14}},
  {id:'recipe-log',foodId:'recipe:receta',name:'Receta',date:'2026-10-13',meal:'Cena',amount:1,unit:'ud',grams:0,nutrients:{kcal:350,protein:18,carbs:42,fat:9}},
 ];
 for(const entry of entries){
  const moved=moveLogEntry(entries,entry.id,'Tentempié');
  assert.deepEqual(moved.find(item=>item.id===entry.id),{...entry,meal:'Tentempié'});
  assert.equal(moved.length,entries.length);
  assert.deepEqual(moved.filter(item=>item.id!==entry.id),entries.filter(item=>item.id!==entry.id));
 }
 assert.deepEqual(moveLogEntry(entries,'missing','Cena'),entries);
});
