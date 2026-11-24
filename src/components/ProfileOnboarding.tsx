import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Activity, ArrowLeft, ArrowRight, Check, ChevronRight, Heart, LockKeyhole, Sparkles } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { blankProfile, targets, type Profile } from '../lib/domain';
import './ProfileOnboarding.css';

type ProfileDraft = Omit<Profile, 'age' | 'height' | 'weight' | 'budget'> & {
  age: string;
  height: string;
  weight: string;
  budget: string;
};

type FieldErrors = Partial<Record<'name' | 'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal' | 'budget', string>>;

const steps = [
  { title: 'Te damos la bienvenida', short: 'Tu nombre' },
  { title: 'Medidas iniciales', short: 'Medidas' },
  { title: 'Tu día a día', short: 'Tu ritmo' },
  { title: 'A tu manera', short: 'Preferencias' },
  { title: 'Tu punto de partida', short: 'Resumen' },
];

const initialDraft: ProfileDraft = {
  ...blankProfile,
  name: '',
  age: '',
  height: '',
  weight: '',
  budget: '',
};

function draftFromProfile(profile: Profile | null): ProfileDraft {
  if (!profile) return initialDraft;
  return {
    ...profile,
    name: profile.name ?? '',
    age: String(profile.age),
    height: String(profile.height),
    weight: String(profile.weight),
    budget: profile.budget === null ? '' : String(profile.budget),
  };
}

const formatNumber = (value: number) => Math.round(value).toLocaleString('es-ES');

export default function ProfileOnboarding({ initialProfile, onComplete }: { initialProfile: Profile | null; onComplete: (profile: Profile) => void }) {
  const form = useForm<ProfileDraft>({ defaultValues: draftFromProfile(initialProfile), mode: 'onChange' });
  const draft = form.watch();
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [sexChosen, setSexChosen] = useState(!!initialProfile);
  const [activityChosen, setActivityChosen] = useState(!!initialProfile);
  const [goalChosen, setGoalChosen] = useState(!!initialProfile);

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    const age = Number(draft.age);
    const height = Number(draft.height);
    const weight = Number(draft.weight);
    const budget = Number(draft.budget);
    if (!draft.name.trim()) next.name = 'Escribe el nombre con el que te gustaría que te llamemos.';
    if (!sexChosen) next.sex = 'Elige una opción para calcular esta estimación.';
    if (!draft.age.trim() || !Number.isFinite(age) || age < 18 || age > 100) next.age = 'La edad debe estar entre 18 y 100 años.';
    if (!draft.height.trim() || !Number.isFinite(height) || height < 100 || height > 250) next.height = 'La altura debe estar entre 100 y 250 cm.';
    if (!draft.weight.trim() || !Number.isFinite(weight) || weight < 30 || weight > 350) next.weight = 'El peso debe estar entre 30 y 350 kg.';
    if (!activityChosen) next.activity = 'Selecciona tu actividad habitual.';
    if (!goalChosen) next.goal = 'Elige el objetivo que quieres usar como referencia.';
    if (draft.budget.trim() && (!Number.isFinite(budget) || budget < 0 || budget > 1000)) next.budget = 'Indica un presupuesto entre 0 y 1.000 €, o deja el campo vacío.';
    return next;
  }, [activityChosen, draft, goalChosen, sexChosen]);

  const profile = useMemo<Profile>(() => ({
    ...draft,
    name: draft.name.trim(),
    age: Number(draft.age) || 0,
    height: Number(draft.height) || 0,
    weight: Number(draft.weight) || 0,
    budget: draft.budget.trim() ? Number(draft.budget) : null,
    manualCalories: null,
    manualProtein: null,
    manualCarbs: null,
    manualFat: null,
  }), [draft]);

  const isReady = Object.keys(errors).length === 0;
  const estimate = useMemo(() => targets(profile), [profile]);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    form.setValue(key, value as never, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }

  function advance() {
    if (step === 0 && errors.name) {
      setShowErrors(true);
      return;
    }
    if (step === 1 && (errors.sex || errors.age || errors.height || errors.weight)) {
      setShowErrors(true);
      return;
    }
    if (step === 2 && (errors.activity || errors.goal)) {
      setShowErrors(true);
      return;
    }
    if (step === 3 && errors.budget) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setShowErrors(false);
    setStep(current => Math.max(current - 1, 0));
  }

  function finish() {
    if (!isReady) {
      setStep(0);
      setShowErrors(true);
      return;
    }
    onComplete(profile);
  }

  const fieldError = (key: keyof FieldErrors) => showErrors ? errors[key] : undefined;

  return (
    <Form {...form}>
    <main className="onboarding" data-testid="profile-onboarding">
      <form className="onboarding-form-root" noValidate onSubmit={event => { event.preventDefault(); if (step === steps.length - 1) finish(); else advance(); }}>
      <div className="onboarding-topline">
        <div className="onboarding-brand" aria-label="Mi Nutrición">
          <span className="onboarding-mark">m</span>
          <span>mi nutrición</span>
        </div>
        <span className="onboarding-private"><LockKeyhole size={13} /> Solo en este dispositivo</span>
      </div>

      <div className="onboarding-progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>
        <div className="onboarding-progress-line"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="onboarding-step-labels">
          {steps.map((item, index) => (
            <span key={item.short} className={index <= step ? 'is-current' : ''} data-testid={`text-onboarding-step-${index + 1}`}>
              {item.short}
            </span>
          ))}
        </div>
      </div>

      <section className="onboarding-content" key={step}>
        {step === 0 && (
          <>
            <div className="onboarding-kicker"><Sparkles size={14} /> Empezamos por lo esencial</div>
            <h1>¿Cómo quieres<br />que te llamemos?</h1>
            <p className="onboarding-intro">Empezaremos por tu nombre. Después podrás añadir las medidas necesarias para crear una referencia personal.</p>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label htmlFor="onboarding-name">¿Cómo te llamamos?</label>
                <input id="onboarding-name" className={fieldError('name') ? 'has-error' : ''} autoComplete="given-name" placeholder="Tu nombre" value={draft.name} onChange={event => update('name', event.target.value)} data-testid="input-onboarding-name" aria-invalid={!!fieldError('name')} />
                {fieldError('name') && <span className="onboarding-error" role="alert">{fieldError('name')}</span>}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="onboarding-kicker"><Activity size={14} /> Datos para tu referencia</div>
            <h1>Tus medidas<br />de partida.</h1>
            <p className="onboarding-intro">Se guardan solo en este dispositivo y puedes actualizarlas más adelante. La estimación está pensada para personas adultas.</p>
            <div className="onboarding-form">
              <fieldset className="onboarding-choice-group">
                <legend>Sexo para la fórmula</legend>
                <div className="onboarding-choice-row">
                  {(['mujer', 'hombre'] as const).map(sex => (
                    <button key={sex} type="button" className={`onboarding-choice ${draft.sex === sex ? 'selected' : ''}`} onClick={() => { update('sex', sex); setSexChosen(true); }} data-testid={`button-onboarding-sex-${sex}`} aria-pressed={draft.sex === sex} aria-invalid={!!fieldError('sex')}>
                      <span className="choice-indicator" />{sex === 'mujer' ? 'Mujer' : 'Hombre'}
                    </button>
                  ))}
                </div>
                {fieldError('sex') && <span className="onboarding-error" role="alert">{fieldError('sex')}</span>}
                <p className="onboarding-hint">Se usa únicamente en la ecuación de estimación.</p>
              </fieldset>
              <div className="onboarding-field">
                <label htmlFor="onboarding-age">Edad</label>
                <div className="onboarding-input-unit"><input id="onboarding-age" className={fieldError('age') ? 'has-error' : ''} type="number" inputMode="numeric" min="18" max="100" placeholder="30" value={draft.age} onChange={event => update('age', event.target.value)} data-testid="input-onboarding-age" aria-invalid={!!fieldError('age')} /><span>años</span></div>
                {fieldError('age') && <span className="onboarding-error" role="alert">{fieldError('age')}</span>}
              </div>
              <div className="onboarding-field">
                <div className="onboarding-measurements">
                  <div className="onboarding-field">
                    <label htmlFor="onboarding-height">Altura</label>
                    <div className="onboarding-input-unit"><input id="onboarding-height" className={fieldError('height') ? 'has-error' : ''} type="number" inputMode="decimal" min="100" max="250" placeholder="165" value={draft.height} onChange={event => update('height', event.target.value)} data-testid="input-onboarding-height" aria-invalid={!!fieldError('height')} /><span>cm</span></div>
                    {fieldError('height') && <span className="onboarding-error" role="alert">{fieldError('height')}</span>}
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="onboarding-weight">Peso actual</label>
                    <div className="onboarding-input-unit"><input id="onboarding-weight" className={fieldError('weight') ? 'has-error' : ''} type="number" inputMode="decimal" min="30" max="350" step="0.1" placeholder="65" value={draft.weight} onChange={event => update('weight', event.target.value)} data-testid="input-onboarding-weight" aria-invalid={!!fieldError('weight')} /><span>kg</span></div>
                    {fieldError('weight') && <span className="onboarding-error" role="alert">{fieldError('weight')}</span>}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="onboarding-kicker"><Activity size={14} /> Sin reglas rígidas</div>
            <h1>¿Cómo se mueve<br />tu semana?</h1>
            <p className="onboarding-intro">Una idea general basta. No hace falta que cada día sea igual.</p>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label htmlFor="onboarding-activity">Actividad habitual</label>
                <select id="onboarding-activity" value={draft.activity} onChange={event => { update('activity', Number(event.target.value)); setActivityChosen(true); }} data-testid="select-onboarding-activity" aria-invalid={!!fieldError('activity')}>
                  <option value="1.2">Principalmente sentada</option>
                  <option value="1.375">Ligera · 1–3 días por semana</option>
                  <option value="1.45">Suave, con movimiento cotidiano</option>
                  <option value="1.55">Moderada · 3–5 días por semana</option>
                  <option value="1.725">Alta · 6–7 días por semana</option>
                </select>
                {fieldError('activity') && <span className="onboarding-error" role="alert">{fieldError('activity')}</span>}
                <span className="onboarding-hint">Cuenta tanto el ejercicio como el movimiento diario.</span>
              </div>
              <fieldset className="onboarding-choice-group">
                <legend>¿Qué te gustaría priorizar?</legend>
                <div className="onboarding-goals">
                  {([
                    { value: 'maintain', title: 'Mantener', copy: 'Encontrar un ritmo estable' },
                    { value: 'lose', title: 'Perder', copy: 'De forma gradual y prudente' },
                    { value: 'gain', title: 'Ganar', copy: 'Acompañar fuerza y energía' },
                  ] as const).map(goal => (
                    <button key={goal.value} type="button" className={`onboarding-goal ${draft.goal === goal.value ? 'selected' : ''}`} onClick={() => { update('goal', goal.value); setGoalChosen(true); }} data-testid={`button-onboarding-goal-${goal.value}`} aria-pressed={draft.goal === goal.value} aria-invalid={!!fieldError('goal')}>
                      <span className="goal-check">{draft.goal === goal.value && <Check size={13} />}</span>
                      <span><strong>{goal.title}</strong><small>{goal.copy}</small></span>
                    </button>
                  ))}
                </div>
                {fieldError('goal') && <span className="onboarding-error" role="alert">{fieldError('goal')}</span>}
              </fieldset>
              {draft.goal !== 'maintain' && (
                <div className="onboarding-field onboarding-pace">
                  <div className="pace-heading"><label htmlFor="onboarding-pace">Ritmo orientativo</label><strong>{draft.pace.toFixed(2).replace('.', ',')} kg/semana</strong></div>
                  <input id="onboarding-pace" type="range" min="0.1" max={draft.goal === 'lose' ? '0.5' : '0.3'} step="0.05" value={draft.pace} onChange={event => update('pace', Number(event.target.value))} data-testid="input-onboarding-pace" />
                  <span className="onboarding-hint">La estimación limita los ajustes para evitar objetivos extremos.</span>
                </div>
              )}
              <div className="onboarding-note"><Heart size={16} /><span>Tu objetivo es una referencia flexible, no una medida de tu progreso personal.</span></div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="onboarding-kicker"><Heart size={14} /> Lo cotidiano también importa</div>
            <h1>Que encaje<br />contigo.</h1>
            <p className="onboarding-intro">Añade detalles si te apetece. Podrás revisarlos más adelante.</p>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label htmlFor="onboarding-preferences">Preferencias alimentarias <span className="optional-label">Opcional</span></label>
                <input id="onboarding-preferences" placeholder="Vegetariana, sin lactosa…" value={draft.preferences} onChange={event => update('preferences', event.target.value)} data-testid="input-onboarding-preferences" />
                <span className="onboarding-hint">Por ejemplo: vegetariana, halal o sin lactosa.</span>
              </div>
              <div className="onboarding-field">
                <label htmlFor="onboarding-avoid">Alimentos que prefieres evitar <span className="optional-label">Opcional</span></label>
                <input id="onboarding-avoid" placeholder="Anota ingredientes" value={draft.avoid} onChange={event => update('avoid', event.target.value)} data-testid="input-onboarding-avoid" />
              </div>
              <div className="onboarding-field">
                <label htmlFor="onboarding-budget">Presupuesto por ración <span className="optional-label">Opcional</span></label>
                <div className="onboarding-input-unit"><input id="onboarding-budget" className={fieldError('budget') ? 'has-error' : ''} type="number" inputMode="decimal" min="0" max="1000" step="0.5" placeholder="Sin límite definido" value={draft.budget} onChange={event => update('budget', event.target.value)} data-testid="input-onboarding-budget" aria-invalid={!!fieldError('budget')} /><span>€</span></div>
                {fieldError('budget') && <span className="onboarding-error" role="alert">{fieldError('budget')}</span>}
              </div>
              <div className="onboarding-privacy-card">
                <span className="privacy-icon"><LockKeyhole size={16} /></span>
                <span><strong>Tus datos se quedan aquí.</strong><small>Mi Nutrición los guarda en el almacenamiento local de este dispositivo. No se envían a ningún servidor.</small></span>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="onboarding-kicker"><Check size={14} /> Revisión final</div>
            <h1>Tu referencia,<br />{draft.name.trim() || 'a tu medida'}.</h1>
            <p className="onboarding-intro">Una estimación para empezar con contexto y sin juicios. Puedes cambiar tus datos cuando quieras.</p>
            <div className="onboarding-summary">
              <div className="summary-primary">
                <span>Objetivo diario estimado</span>
                <strong>{formatNumber(estimate.calories)}<small> kcal</small></strong>
                <div className="summary-subline">Basado en {formatNumber(estimate.tdee)} kcal de gasto diario</div>
              </div>
              <div className="summary-metrics">
                <div><span>Metabolismo basal</span><strong>{formatNumber(estimate.bmr)} <small>kcal</small></strong></div>
                <div><span>Gasto diario</span><strong>{formatNumber(estimate.tdee)} <small>kcal</small></strong></div>
              </div>
              <div className="summary-macros">
                <div className="macro-heading"><strong>Reparto orientativo</strong><span>por día</span></div>
                <div className="macro-row protein"><span><i />Proteína</span><strong>{formatNumber(estimate.protein)} g</strong></div>
                <div className="macro-row carbs"><span><i />Carbohidratos</span><strong>{formatNumber(estimate.carbs)} g</strong></div>
                <div className="macro-row fat"><span><i />Grasas</span><strong>{formatNumber(estimate.fat)} g</strong></div>
              </div>
            </div>
            <p className="onboarding-disclaimer">Son cálculos orientativos, no consejo médico. Las necesidades reales varían; consulta con un profesional si lo necesitas.</p>
            <div className="onboarding-confirm-note"><LockKeyhole size={14} /> Al confirmar, tu perfil se guardará únicamente en este dispositivo.</div>
          </>
        )}
      </section>

      <div className="onboarding-actions">
        {step > 0 ? (
          <button type="button" className="onboarding-back" onClick={goBack} data-testid="button-onboarding-back"><ArrowLeft size={16} /> Atrás</button>
        ) : <span className="onboarding-step-count">Paso {step + 1} de {steps.length}</span>}
        {step < steps.length - 1 ? (
          <button type="submit" className="onboarding-next" data-testid="button-onboarding-next">
            {step === 3 ? 'Ver mi estimación' : 'Continuar'} <ArrowRight size={17} />
          </button>
        ) : (
          <button type="submit" className="onboarding-next onboarding-finish" data-testid="button-onboarding-confirm">
            Confirmar y empezar <ChevronRight size={17} />
          </button>
        )}
      </div>
      <p className="onboarding-footnote">Estimaciones basadas en Mifflin–St Jeor y tu actividad declarada.</p>
      </form>
    </main>
    </Form>
  );
}
