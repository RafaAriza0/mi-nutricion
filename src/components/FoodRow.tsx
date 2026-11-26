import { Heart, Plus, Settings2, Trash2 } from 'lucide-react';
import type { Food } from '../lib/domain';
import { foodDisplayName, labelCategory, useLang } from '../lib/i18n';

const fmt = (n: number) => Math.round(n).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES');

export default function FoodRow({
  food,
  favorite,
  onFavorite,
  onEdit,
  onDelete,
  onAdd,
}: {
  food: Food;
  favorite: boolean;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdd: () => void;
}) {
  const [lang] = useLang();
  const isEn = lang === 'en';
  const displayName = foodDisplayName(food.id, food.name, lang);
  const displaySource = food.source.startsWith('Ejemplo orientativo') && isEn ? 'Sample reference' : food.source;

  return (
    <div className="list-row" data-testid={`row-food-${food.id}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{displayName}</b>
          {food.category && <span className="pill">{labelCategory(food.category, lang)}</span>}
          {food.catalog && <span className="pill">BEDCA</span>}
          {food.demo && <span className="pill demo-pill">{isEn ? 'Sample' : 'Ejemplo'}</span>}
          {food.source.startsWith('Open Food Facts') && <span className="pill demo-pill">{isEn ? 'Label checked' : 'Etiqueta revisada'}</span>}
        </div>
        <div className="small-text muted">
          {fmt(food.kcal)} kcal · P {food.protein.toFixed(1)} · C {food.carbs.toFixed(1)} · {isEn ? 'F' : 'G'} {food.fat.toFixed(1)} g / 100 g · {displaySource}
        </div>
        <div className="small-text muted">
          {isEn ? 'Reviewed' : 'Revisado'}: {food.reviewed}
          {food.barcode ? ` · ${isEn ? 'Barcode' : 'Código'}: ${food.barcode}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <button
          className="icon-button"
          onClick={onFavorite}
          aria-label={favorite ? (isEn ? 'Remove favorite' : 'Quitar de favoritos') : isEn ? 'Add favorite' : 'Añadir a favoritos'}
          data-testid={`button-favorite-food-${food.id}`}
        >
          <Heart size={17} fill={favorite ? '#729574' : 'none'} color={favorite ? '#729574' : 'currentColor'} />
        </button>
        {!food.demo && !food.catalog && (
          <>
            <button className="icon-button" onClick={onEdit} aria-label={`${isEn ? 'Edit' : 'Editar'} ${displayName}`} data-testid={`button-edit-food-${food.id}`}>
              <Settings2 size={16} />
            </button>
            <button className="icon-button" onClick={onDelete} aria-label={`${isEn ? 'Delete' : 'Eliminar'} ${displayName}`} data-testid={`button-delete-food-${food.id}`}>
              <Trash2 size={16} />
            </button>
          </>
        )}
        <button className="button secondary small" onClick={onAdd} data-testid={`button-add-food-${food.id}`}>
          <Plus size={14} /> {isEn ? 'Add' : 'Añadir'}
        </button>
      </div>
    </div>
  );
}