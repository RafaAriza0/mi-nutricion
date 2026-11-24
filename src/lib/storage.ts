import { blankProfile, emptyStore, type Store } from './domain';
const KEY='mi-nutricion.personal.v1';
export function loadStore():Store {
 try { const raw=localStorage.getItem(KEY); if(!raw)return emptyStore(); const value=JSON.parse(raw) as Partial<Store>; return {...emptyStore(),...value,profile:value.profile?{...blankProfile,...value.profile}:null,foods:value.foods??[],logs:value.logs??[],dishes:value.dishes??[],favorites:value.favorites??[],recipeFavorites:value.recipeFavorites??[],recent:value.recent??[],weights:value.weights??[]}; }
 catch { return emptyStore(); }
}
export function saveStore(store:Store):{ok:boolean;message?:string} {
 try { localStorage.setItem(KEY,JSON.stringify(store)); return {ok:true}; }
 catch { return {ok:false,message:'No se pudo guardar. El almacenamiento del navegador está lleno o desactivado. Prueba sin foto o elimina datos del sitio.'}; }
}
export function clearPersonalStore() { try { localStorage.removeItem(KEY); return true; } catch { return false; } }
