import { type FormEvent, useState } from 'react';
import { useLang } from '../lib/i18n';
import { supabase } from '../lib/supabase';

export default function AuthGate() {
  const [lang, setLang] = useLang();
  const isEn = lang === 'en';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleGoogleLogin() {
    setError('');
    setInfo('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');

    const cleanEmail = email.trim();
    if (!cleanEmail || password.length < 6) {
      setError(
        isEn
          ? 'Enter a valid email and a password of at least 6 characters.'
          : 'Introduce un correo válido y una contraseña de al menos 6 caracteres.'
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setInfo(
            isEn
              ? 'Account created. Check your inbox to confirm your email.'
              : 'Cuenta creada. Revisa tu bandeja de entrada para confirmar tu correo.'
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
          ? 'Could not complete sign in.'
          : 'No se pudo completar el acceso.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap" style={{ maxWidth: 460, paddingTop: 48 }}>
      <section className="card panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="eyebrow">
            {isEn ? 'Mi Nutrición · Cloud Space' : 'Mi Nutrición · Espacio en la nube'}
          </div>
          <button
            type="button"
            className="button ghost small"
            onClick={() => setLang(isEn ? 'es' : 'en')}
            aria-label={isEn ? 'Cambiar a español' : 'Switch to English'}
            data-testid="button-auth-toggle-lang"
          >
            {isEn ? 'ES' : 'EN'}
          </button>
        </div>

        <h1 className="serif" style={{ fontSize: 30, margin: '8px 0 8px' }}>
          {mode === 'login'
            ? isEn
              ? 'Sign in to your space'
              : 'Inicia sesión en tu espacio'
            : isEn
            ? 'Create your personal account'
            : 'Crea tu cuenta personal'}
        </h1>
        <p className="small-text muted" style={{ marginBottom: 20 }}>
          {isEn
            ? 'Save your profile, foods, and daily logs privately to access them from any device.'
            : 'Guarda tu perfil, alimentos y registros diarios de forma privada para acceder desde cualquier dispositivo.'}
        </p>

        <button
          type="button"
          className="button"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => void handleGoogleLogin()}
          disabled={loading}
          data-testid="button-google-login"
        >
          {isEn ? 'Continue with Google' : 'Continuar con Google'}
        </button>

        <div className="divider" style={{ margin: '18px 0' }} />

        <form onSubmit={(e) => void handleEmailSubmit(e)} className="grid">
          <div className="field">
            <label htmlFor="auth-email">{isEn ? 'Email address' : 'Correo electrónico'}</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isEn ? 'you@email.com' : 'tu@correo.com'}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">{isEn ? 'Password' : 'Contraseña'}</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEn ? 'At least 6 characters' : 'Mínimo 6 caracteres'}
            />
          </div>

          {error && (
            <p className="small-text" role="alert" style={{ color: '#a14c3f', margin: 0 }}>
              {error}
            </p>
          )}
          {info && (
            <p className="small-text" role="status" style={{ color: '#5b8b68', margin: 0 }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            className="button secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
            data-testid="button-email-submit"
          >
            {loading
              ? isEn
                ? 'Processing…'
                : 'Procesando…'
              : mode === 'login'
              ? isEn
                ? 'Sign in with email'
                : 'Entrar con correo'
              : isEn
              ? 'Create account'
              : 'Crear cuenta'}
          </button>
        </form>

        <p className="small-text muted" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          {mode === 'login'
            ? isEn
              ? "Don't have an account yet? "
              : '¿Aún no tienes cuenta? '
            : isEn
            ? 'Already have an account? '
            : '¿Ya tienes cuenta? '}
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setInfo('');
            }}
          >
            {mode === 'login'
              ? isEn
                ? 'Sign up here'
                : 'Regístrate aquí'
              : isEn
              ? 'Sign in'
              : 'Inicia sesión'}
          </button>
        </p>
      </section>
    </main>
  );
}