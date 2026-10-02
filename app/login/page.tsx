'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkCurrentSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/');
      } else {
        setCheckingSession(false);
      }
    }
    checkCurrentSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect.'
            : error.message
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        router.replace('/');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Load failed') || err.message.includes('Failed to fetch')) {
          setErrorMsg('Impossible de joindre Supabase. Veuillez vérifier votre connexion ou réessayer.');
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('Une erreur inattendue est survenue.');
      }
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111b21] text-[#8696a0]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00a884]"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#0c1317] text-[#e9edef] relative overflow-hidden">
      {/* Bandeau vert supérieur type WhatsApp */}
      <div className="h-40 bg-[#00a884] w-full absolute top-0 left-0 z-0"></div>

      <div className="relative z-10 w-full max-w-md bg-[#111b21] border border-[#222e35] rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00a884] text-[#111b21] font-black text-2xl shadow-lg mb-2">
            K
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Connexion à Kouma</h1>
          <p className="text-xs text-[#8696a0]">
            Messagerie instantanée bilingue Dioula ⇋ Français
          </p>
        </div>

        {justRegistered && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
            <span>✅</span>
            <span>Compte créé avec succès ! Connectez-vous maintenant.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8696a0] mb-1.5">
              Adresse Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              className="w-full px-4 py-2.5 rounded-lg bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8696a0] mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-slate-950 font-bold text-sm transition-all shadow-lg shadow-[#00a884]/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#222e35] text-center">
          <p className="text-xs text-[#8696a0]">
            Vous n'avez pas encore de compte ?{' '}
            <Link
              href="/signup"
              className="font-medium text-[#00a884] hover:underline underline-offset-4"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}