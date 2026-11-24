import type { Nutrients } from '../lib/domain';

const fmt = (value: number) => Math.round(value).toLocaleString('es-ES');

export default function NutrientSummary({ nutrients, label }: { nutrients: Nutrients; label: string }) {
  const items = [
    { key: 'energy', name: 'Energía', value: fmt(nutrients.kcal), unit: 'kcal' },
    { key: 'protein', name: 'Proteína', value: nutrients.protein.toFixed(1), unit: 'g' },
    { key: 'carbs', name: 'Carbohidratos', value: nutrients.carbs.toFixed(1), unit: 'g' },
    { key: 'fat', name: 'Grasas', value: nutrients.fat.toFixed(1), unit: 'g' },
  ];

  return <div className="nutrition-summary" role="group" aria-label={label}>
    {items.map(item => <div className="nutrition-summary-item" data-nutrient={item.key} key={item.name}>
      <span>{item.name}</span>
      <strong>{item.value} <small>{item.unit}</small></strong>
    </div>)}
  </div>;
}
