import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Route API pour créer automatiquement un profil après l'inscription
// Cette route utilise le service role key pour contourner les RLS
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username, language } = body;

    if (!userId || !username) {
      return NextResponse.json({ error: 'userId et username requis' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jqbhavgofbdvkeberovc.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_TddZu6G_crUDWTr6im_oMw_2tBmMUjk';

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const { error } = await adminClient.from('profiles').upsert({
      id: userId,
      username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
    }, { onConflict: 'id' });

    if (error) {
      console.error('Erreur upsert profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
