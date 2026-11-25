import { type FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthGate() {
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
      setError('Introduce un correo válido y una contraseña de al menos 6 caracteres.');
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
          setInfo('Cuenta creada. Revisa tu bandeja de entrada para confirmar tu correo.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el acceso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap" style={{ maxWidth: 460, paddingTop: 48 }}>
      <section className="card panel">
        <div className="eyebrow">Mi Nutrición · Espacio en la nube</div>
        <h1 className="serif" style={{ fontSize: 30, margin: '8px 0 8px' }}>
          {mode === 'login' ? 'Inicia sesión en tu espacio' : 'Crea tu cuenta personal'}
        </h1>
        <p className="small-text muted" style={{ marginBottom: 20 }}>
          Guarda tu perfil, alimentos y registros diarios de forma privada para acceder desde cualquier dispositivo.
        </p>

        <button
          type="button"
          className="button"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => void handleGoogleLogin()}
          disabled={loading}
          data-testid="button-google-login"
        >
          Continuar con Google
        </button>

        <div className="divider" style={{ margin: '18px 0' }} />

        <form onSubmit={(e) => void handleEmailSubmit(e)} className="grid">
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
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
              ? 'Procesando…'
              : mode === 'login'
              ? 'Entrar con correo'
              : 'Crear cuenta'}
          </button>
        </form>

        <p className="small-text muted" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          {mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setInfo('');
            }}
          >
            {mode === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
          </button>
        </p>
      </section>
    </main>
  );
}