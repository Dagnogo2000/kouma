'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredLang, setPreferredLang] = useState<'fr' | 'dyu'>('fr');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            preferred_language: preferredLang,
          }
        }
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Enregistrer la préférence de langue locale
      localStorage.setItem('kouma_lang', preferredLang);

      // Enregistrer l'utilisateur dans le registre local partagé pour qu'il soit toujours visible
      const newUserId = data.user?.id || `user_${Date.now()}`;
      const newUserName = email.split('@')[0];
      try {
        const existingUsers = JSON.parse(localStorage.getItem('kouma_all_users') || '[]');
        if (!existingUsers.some((u: { email: string }) => u.email === email)) {
          existingUsers.push({
            id: newUserId,
            username: newUserName,
            email: email.trim(),
            language: preferredLang,
          });
          localStorage.setItem('kouma_all_users', JSON.stringify(existingUsers));
        }

        // 1. Tenter l'insertion dans la table Supabase profiles
        if (data.user?.id) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: newUserName,
            email: email.trim(),
            language: preferredLang,
          }, { onConflict: 'id' }).then(({ error }) => { if (error) console.warn(error); });
        }

        // 2. Enregistrer la présence dans la table messages (visible par tous les clients)
        if (data.user?.id) {
          const presenceKey = `__presence__${data.user.id}`;
          const encoded = JSON.stringify({
            type: '__presence__',
            id: data.user.id,
            email: email.trim(),
            username: newUserName,
            language: preferredLang,
          });
          await supabase.from('messages').insert({
            sender_id: data.user.id,
            receiver_id: presenceKey,
            content: encoded,
          }).then(({ error }) => { if (error) console.warn(error); });
        }

        // 3. Broadcaster la présence en temps réel via le canal Supabase
        if (data.user?.id) {
          const presenceChannel = supabase.channel('kouma_main');
          presenceChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              presenceChannel.send({
                type: 'broadcast',
                event: 'user_joined',
                payload: {
                  id: data.user!.id,
                  username: newUserName,
                  email: email.trim(),
                  language: preferredLang,
                },
              });
              // Fermer le canal après envoi
              setTimeout(() => supabase.removeChannel(presenceChannel), 2000);
            }
          });
        }
      } catch (saveErr) {
        console.warn('Erreur sauvegarde profil:', saveErr);
      }

      if (data.session) {
        router.push('/');
        router.refresh();
      } else if (data.user) {
        setSuccessMsg('Compte créé avec succès ! Vous pouvez maintenant vous connecter ou discuter avec ce compte.');
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
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
      {/* Bandeau vert supérieur WhatsApp */}
      <div className="h-40 bg-[#00a884] w-full absolute top-0 left-0 z-0"></div>

      <div className="relative z-10 w-full max-w-md bg-[#111b21] border border-[#222e35] rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00a884] text-[#111b21] font-black text-2xl shadow-lg mb-2">
            K
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Rejoindre Kouma</h1>
          <p className="text-xs text-[#8696a0]">
            Votre compte de messagerie bilingue Dioula ⇋ Français
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
            <span>✅</span>
            <span>{successMsg}</span>
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

          {/* Choix de la langue préférée à l'inscription */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8696a0] mb-1.5">
              Votre langue principale
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPreferredLang('fr')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  preferredLang === 'fr'
                    ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                    : 'bg-[#202c33] border-[#2a3942] text-[#8696a0]'
                }`}
              >
                <span>🇫🇷</span>
                <span>Français</span>
              </button>
              <button
                type="button"
                onClick={() => setPreferredLang('dyu')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  preferredLang === 'dyu'
                    ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                    : 'bg-[#202c33] border-[#2a3942] text-[#8696a0]'
                }`}
              >
                <span>🇨🇮</span>
                <span>Dioula (Julakan)</span>
              </button>
            </div>
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
              placeholder="Au moins 6 caractères"
              className="w-full px-4 py-2.5 rounded-lg bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8696a0] mb-1.5">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répétez le mot de passe"
              className="w-full px-4 py-2.5 rounded-lg bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-slate-950 font-bold text-sm transition-all shadow-lg shadow-[#00a884]/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
          >
            {loading ? 'Création en cours...' : 'Créer mon compte'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#222e35] text-center">
          <p className="text-xs text-[#8696a0]">
            Vous avez déjà un compte ?{' '}
            <Link
              href="/login"
              className="font-medium text-[#00a884] hover:underline underline-offset-4"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}