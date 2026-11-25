import { blankProfile, emptyStore, type Store } from './domain';
import { supabase } from './supabase';

const KEY = 'mi-nutricion.personal.v1';

export function normalizeStore(value?: Partial<Store> | null): Store {
  const base = emptyStore();
  if (!value) return base;
  return {
    ...base,
    ...value,
    profile: value.profile ? { ...blankProfile, ...value.profile } : null,
    foods: value.foods ?? [],
    logs: value.logs ?? [],
    dishes: value.dishes ?? [],
    favorites: value.favorites ?? [],
    recipeFavorites: value.recipeFavorites ?? [],
    recent: value.recent ?? [],
    weights: value.weights ?? [],
  };
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw) as Partial<Store>);
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: Store): { ok: boolean; message?: string } {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        'No se pudo guardar. El almacenamiento del navegador está lleno o desactivado. Prueba sin foto o elimina datos del sitio.',
    };
  }
}

export function clearPersonalStore() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

function hasPersonalData(store: Store): boolean {
  return Boolean(
    store.profile ||
      store.foods.length ||
      store.logs.length ||
      store.dishes.length ||
      store.weights.length
  );
}

export async function loadCloudStore(userId: string): Promise<Store> {
  const { data, error } = await supabase
    .from('user_stores')
    .select('store_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data?.store_data) {
    const cloudStore = normalizeStore(data.store_data as Partial<Store>);
    saveStore(cloudStore);
    return cloudStore;
  }

  // Si es la primera vez en la nube pero hay datos locales previos, los migramos
  const local = loadStore();
  if (hasPersonalData(local)) {
    await saveCloudStore(userId, local);
    return local;
  }

  const fresh = emptyStore();
  saveStore(fresh);
  return fresh;
}

export async function saveCloudStore(
  userId: string,
  store: Store
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('user_stores').upsert(
    {
      user_id: userId,
      store_data: store,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return {
      ok: false,
      message: 'No se pudo sincronizar con la nube. Tus cambios siguen guardados en este dispositivo.',
    };
  }
  return { ok: true };
}