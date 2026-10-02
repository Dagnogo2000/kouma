-- ==============================================================================
-- POLITIQUES RLS SÉCURISÉES POUR KOUMA (AVEC TYPES UUID STRICTS)
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query > Run
-- ==============================================================================

-- 1. SÉCURITÉ SUR LA TABLE PROFILES
alter table public.profiles enable row level security;

drop policy if exists "Tous les utilisateurs authentifiés peuvent lire les profils" on public.profiles;
drop policy if exists "Lecture des profils pour tous" on public.profiles;
drop policy if exists "Lecture publique des profils" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "Les utilisateurs peuvent insérer leur propre profil" on public.profiles;
drop policy if exists "Insertion profil utilisateur" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "Les utilisateurs peuvent modifier leur propre profil" on public.profiles;
drop policy if exists "Mise a jour profil utilisateur" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- Seuls les utilisateurs connectés peuvent voir les profils (annuaire)
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Un utilisateur ne peut créer que son propre profil
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Un utilisateur ne peut modifier que son propre profil
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ==============================================================================
-- 2. SÉCURITÉ SUR LA TABLE MESSAGES (Types UUID)
-- ==============================================================================
alter table public.messages enable row level security;

drop policy if exists "Les utilisateurs authentifiés peuvent lire les messages" on public.messages;
drop policy if exists "Lecture des messages pour tous" on public.messages;
drop policy if exists "Lecture des messages" on public.messages;
drop policy if exists "messages_select_secure" on public.messages;
drop policy if exists "Les utilisateurs authentifiés peuvent envoyer des messages" on public.messages;
drop policy if exists "Insertion de messages" on public.messages;
drop policy if exists "messages_insert_secure" on public.messages;

-- RÈGLE 1 : Confidentialité stricte des messages
-- L'utilisateur ne peut lire que :
--   - Les messages qu'il a envoyés (sender_id = auth.uid())
--   - Les messages qu'il a reçus (receiver_id = auth.uid())
--   - Les messages du salon public (receiver_id IS NULL)
create policy "messages_select_secure"
  on public.messages
  for select
  to authenticated
  using (
    sender_id = auth.uid()
    or receiver_id = auth.uid()
    or receiver_id is null
  );

-- RÈGLE 2 : Insertion strictement vérifiée
-- Impossible d'usurper l'identité d'un autre utilisateur
create policy "messages_insert_secure"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
  );

-- ==============================================================================
-- 3. ACTIVATION DU TEMPS RÉEL (REALTIME)
-- ==============================================================================
alter table public.messages replica identity full;
alter table public.profiles replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
