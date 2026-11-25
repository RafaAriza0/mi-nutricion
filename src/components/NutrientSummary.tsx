import type { Nutrients } from '../lib/domain';
import { getLocale, useLang } from '../lib/i18n';

export default function NutrientSummary({ nutrients, label }: { nutrients: Nutrients; label: string }) {
  const [lang] = useLang();
  const fmt = (value: number) => Math.round(value).toLocaleString(getLocale(lang));

  const items = [
    { key: 'energy', name: lang === 'en' ? 'Energy' : 'Energía', value: fmt(nutrients.kcal), unit: 'kcal' },
    { key: 'protein', name: lang === 'en' ? 'Protein' : 'Proteína', value: nutrients.protein.toFixed(1), unit: 'g' },
    { key: 'carbs', name: lang === 'en' ? 'Carbs' : 'Carbohidratos', value: nutrients.carbs.toFixed(1), unit: 'g' },
    { key: 'fat', name: lang === 'en' ? 'Fat' : 'Grasas', value: nutrients.fat.toFixed(1), unit: 'g' },
  ];

  return (
    <div className="nutrition-summary" role="group" aria-label={label}>
      {items.map(item => (
        <div className="nutrition-summary-item" data-nutrient={item.key} key={item.key}>
          <span>{item.name}</span>
          <strong>
            {item.value} <small>{item.unit}</small>
          </strong>
        </div>
      ))}
    </div>
  );
}