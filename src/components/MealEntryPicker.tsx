import { useMemo, useState } from 'react';
import { BookOpen, ChefHat, Clock3, History, Plus, Search, Utensils } from 'lucide-react';
import { mealNames, type Meal, type Nutrients } from '../lib/domain';
import NutrientSummary from './NutrientSummary';

export type MealEntryOption = {
  key: string;
  id: string;
  kind: 'food' | 'dish' | 'recipe' | 'history';
  name: string;
  source: string;
  nutrients: Nutrients;
  gramsPerUnit?: number;
  unit?: string;
  demo?: boolean;
  tags?: string[];
  compatibility?: string;
};

const tabs = [
  { id: 'food', label: 'Alimentos', icon: Utensils },
  { id: 'dish', label: 'Mis platos', icon: ChefHat },
  { id: 'recipe', label: 'Sugerencias', icon: BookOpen },
  { id: 'history', label: 'Recientes', icon: History },
] as const;

type Tab = typeof tabs[number]['id'];

export default function MealEntryPicker({
  options,
  initialTab = 'food',
  initialSelection,
  date,
  meal,
  onMealChange,
  onCreateDish,
  onConfirm,
}: {
  options: MealEntryOption[];
  initialTab?: Tab;
  initialSelection?: string;
  date: string;
  meal: Meal;
  onMealChange: (meal: Meal) => void;
  onCreateDish: () => void;
  onConfirm: (option: MealEntryOption, amount: number, unit: 'g' | 'ud') => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const initialOption = options.find(option => option.id === initialSelection);
  const [selectedKey, setSelectedKey] = useState(initialOption?.key ?? '');
  const [amount, setAmount] = useState(initialOption?.kind === 'food' ? '100' : initialOption ? '1' : '100');
  const [unit, setUnit] = useState<'g' | 'ud'>(initialOption?.kind === 'food' ? 'g' : initialOption ? 'ud' : 'g');
  const visibleOptions = useMemo(() => options
    .filter(option => option.kind === tab || (tab === 'history' && option.kind === 'history'))
    .filter(option => `${option.name} ${option.source} ${(option.tags ?? []).join(' ')}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
    .slice(0, tab === 'food' ? 50 : 30), [options, query, tab]);
  const selected = options.find(option => option.key === selectedKey);

  function choose(option: MealEntryOption) {
    setSelectedKey(option.key);
    setAmount(option.kind === 'food' ? '100' : '1');
    setUnit(option.kind === 'food' ? 'g' : 'ud');
  }

  const displayed = selected ? selected.kind === 'food'
    ? {
      kcal: selected.nutrients.kcal * (unit === 'ud' ? Number(amount) * (selected.gramsPerUnit ?? 100) : Number(amount)) / 100,
      protein: selected.nutrients.protein * (unit === 'ud' ? Number(amount) * (selected.gramsPerUnit ?? 100) : Number(amount)) / 100,
      carbs: selected.nutrients.carbs * (unit === 'ud' ? Number(amount) * (selected.gramsPerUnit ?? 100) : Number(amount)) / 100,
      fat: selected.nutrients.fat * (unit === 'ud' ? Number(amount) * (selected.gramsPerUnit ?? 100) : Number(amount)) / 100,
    }
    : Object.fromEntries(Object.entries(selected.nutrients).map(([key, value]) => [key, value * Number(amount)])) as Nutrients
    : null;

  return <div className="meal-picker">
    <p className="small-text muted" style={{ marginTop: 0 }} data-testid="text-entry-destination">
      Registro para el {new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.
    </p>
    <div className="field">
      <label htmlFor="select-log-meal">Comida</label>
      <select id="select-log-meal" className="select" value={meal} onChange={event => onMealChange(event.target.value as Meal)} data-testid="select-log-meal">
        {mealNames.map(name => <option key={name}>{name}</option>)}
      </select>
    </div>
    <div className="meal-picker-tabs" role="tablist" aria-label="Tipo de registro">
      {tabs.map(({ id: tabId, label, icon: Icon }) => <button
        key={tabId}
        type="button"
        role="tab"
        aria-selected={tab === tabId}
        className={`tab ${tab === tabId ? 'selected' : ''}`}
        onClick={() => { setTab(tabId); setSelectedKey(''); setQuery(''); }}
        data-testid={`tab-log-${tabId}`}
      ><Icon size={15}/><span>{label}</span></button>)}
    </div>
    <label className="meal-picker-search">
      <Search size={16} aria-hidden="true"/>
      <span className="sr-only">Buscar {tabs.find(item => item.id === tab)?.label.toLowerCase()}</span>
      <input className="input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'food' ? 'Buscar alimentos' : 'Buscar por nombre o etiqueta'} data-testid="input-log-search"/>
    </label>
    {tab === 'dish' && <button type="button" className="button secondary small meal-picker-create" onClick={onCreateDish} data-testid="button-create-dish-from-log"><Plus size={15}/> Crear un plato personal</button>}
    <div className="meal-picker-list" aria-label="Opciones para registrar">
      {visibleOptions.map(option => <button
        type="button"
        key={option.key}
        className={`meal-picker-option${selectedKey === option.key ? ' active' : ''}`}
        aria-pressed={selectedKey === option.key}
        onClick={() => choose(option)}
        data-testid={`option-log-${option.key.replaceAll(':', '-')}`}
      >
        <span className="meal-picker-option-copy">
          <b>{option.name}</b>
          <span className="small-text muted">{option.source}{option.tags?.length ? ` · ${option.tags.join(' · ')}` : ''}</span>
          <NutrientSummary nutrients={option.nutrients} label={option.kind === 'food' ? 'Aporte por 100 gramos' : 'Aporte por ración'}/>
          {option.compatibility && <span className="meal-picker-fit">{option.compatibility}</span>}
        </span>
        <span className="meal-picker-select">{selectedKey === option.key ? 'Elegido' : 'Elegir'}</span>
      </button>)}
      {!visibleOptions.length && <div className="empty" role="status" data-testid={`empty-log-${tab}`}>
        {tab === 'history'
          ? 'Aún no hay platos ni recetas anteriores para repetir.'
          : tab === 'dish'
            ? 'No hay platos guardados con este nombre. Puedes crear uno aquí.'
            : tab === 'recipe'
              ? 'No hay sugerencias con esta búsqueda. Prueba otro término.'
              : 'No encontramos alimentos. Prueba otro término.'}
      </div>}
    </div>
    {selected && <section className="meal-picker-confirm" aria-label="Confirmar registro">
      <div className="meal-picker-summary">
        <div><span className="eyebrow">{selected.source}</span><h3>{selected.name}</h3></div>
        {selected.kind === 'food' && selected.unit !== 'g' && <label className="meal-picker-unit"><span className="sr-only">Unidad del alimento</span><select aria-label="Unidad del alimento" className="select" value={unit} onChange={event => setUnit(event.target.value as 'g' | 'ud')} data-testid="select-log-unit"><option value="g">gramos</option><option value="ud">{selected.unit ?? 'unidades'}</option></select></label>}
      </div>
      <div className="field">
        <label htmlFor="input-log-amount">{selected.kind === 'food' ? `Cantidad (${unit === 'g' ? 'g' : selected.unit ?? 'unidades'})` : 'Raciones'}</label>
        <input id="input-log-amount" className="input" type="number" min=".1" step=".1" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} data-testid="input-log-amount"/>
      </div>
      {displayed && <div aria-live="polite"><NutrientSummary nutrients={displayed} label="Aporte para la cantidad elegida"/></div>}
      {selected.kind === 'history' && <p className="small-text muted">Se repetirán los valores nutricionales guardados en el registro original.</p>}
      <button type="button" className="button" style={{ width: '100%' }} disabled={!Number.isFinite(Number(amount)) || Number(amount) <= 0} onClick={() => onConfirm(selected, Number(amount), unit)} data-testid="button-confirm-log"><Clock3 size={15}/> Añadir al registro</button>
    </section>}
  </div>;
}
