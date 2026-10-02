import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0c1317] text-[#e9edef] relative">
      <div className="h-32 bg-[#00a884] w-full absolute top-0 left-0 z-0"></div>

      <div className="relative z-10 max-w-md w-full text-center space-y-6 bg-[#111b21] p-8 rounded-2xl border border-[#222e35] shadow-2xl">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#00a884]/20 text-[#00a884] text-3xl font-extrabold border border-[#00a884]/30">
          404
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Page introuvable</h1>
          <p className="text-xs text-[#8696a0]">
            L'adresse demandée n'existe pas ou a été déplacée.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-[#00a884]/20 hover:scale-[1.02]"
          >
            Retour aux discussions
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-white font-medium text-sm transition-all border border-[#2a3942] hover:scale-[1.02]"
          >
            Connexion
          </Link>
        </div>
      </div>
    </main>
  );
}
