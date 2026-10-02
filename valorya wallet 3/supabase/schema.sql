-- Fideli MVP. À exécuter dans Supabase SQL Editor avant de déployer le site.
-- Les anciens établissements n'ont pas de propriétaire : leur owner_id doit être attribué
-- manuellement à un utilisateur Auth vérifié avant qu'ils soient administrables.
create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.businesses add column if not exists owner_id uuid references auth.users(id);
alter table public.businesses add column if not exists category text;
alter table public.businesses add column if not exists address text;
create unique index if not exists businesses_owner_unique on public.businesses(owner_id) where owner_id is not null;
alter table public.businesses drop constraint if exists businesses_slug_format;
alter table public.businesses add constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 50);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reward_name text not null,
  required_visits integer not null check (required_visits > 0),
  active boolean not null default true
);
create unique index if not exists one_active_program_per_business on public.programs(business_id) where active;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (customer_id, program_id)
);
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  redeemed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.private_feedback (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create table if not exists public.physical_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  membership_id uuid references public.memberships(id) on delete set null,
  status text not null default 'unassigned' check (status in ('unassigned','active','lost','replaced')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_active_card_per_membership on public.physical_cards(membership_id) where status = 'active';
create index if not exists membership_program_idx on public.memberships(program_id);
create index if not exists visits_membership_idx on public.visits(membership_id);
create index if not exists redemptions_membership_idx on public.redemptions(membership_id);
create index if not exists cards_business_idx on public.physical_cards(business_id);

create or replace function public.owns_business(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.businesses where id = p_id and owner_id = (select auth.uid()));
$$;
revoke all on function public.owns_business(uuid) from public;
grant execute on function public.owns_business(uuid) to authenticated;

create or replace function public.merchant_can_read_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m join public.programs p on p.id=m.program_id
    join public.businesses b on b.id=p.business_id
    where m.customer_id=p_customer and b.owner_id=(select auth.uid()));
$$;
revoke all on function public.merchant_can_read_customer(uuid) from public;
grant execute on function public.merchant_can_read_customer(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.programs enable row level security;
alter table public.customers enable row level security;
alter table public.memberships enable row level security;
alter table public.visits enable row level security;
alter table public.redemptions enable row level security;
alter table public.private_feedback enable row level security;
alter table public.physical_cards enable row level security;

-- Supprime aussi les anciennes politiques éventuellement permissives avant d'installer celles du MVP.
-- À exécuter après sauvegarde : les accès d'anciennes versions sont volontairement remplacés.
do $$
declare item record;
begin
  for item in select schemaname,tablename,policyname from pg_catalog.pg_policies
    where schemaname='public' and tablename in
    ('businesses','programs','customers','memberships','visits','redemptions','private_feedback','physical_cards')
  loop
    execute format('drop policy %I on %I.%I',item.policyname,item.schemaname,item.tablename);
  end loop;
end $$;

-- Business name and active program are public for /join/[slug]. No customer data is public.
drop policy if exists business_public_read on public.businesses;
create policy business_public_read on public.businesses for select to anon,authenticated using (true);
drop policy if exists business_owner_insert on public.businesses;
create policy business_owner_insert on public.businesses for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists business_owner_update on public.businesses;
create policy business_owner_update on public.businesses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists program_public_read on public.programs;
create policy program_public_read on public.programs for select to anon,authenticated using (active or (select public.owns_business(business_id)));
drop policy if exists program_owner_insert on public.programs;
create policy program_owner_insert on public.programs for insert to authenticated with check ((select public.owns_business(business_id)));
drop policy if exists program_owner_update on public.programs;
-- Le seuil de récompense est figé après création : le modifier rétroactivement fausserait les soldes.

drop policy if exists customer_scoped_read on public.customers;
create policy customer_scoped_read on public.customers for select to authenticated using (
  auth_user_id = (select auth.uid()) or (select public.merchant_can_read_customer(id))
);
drop policy if exists customer_self_insert on public.customers;
create policy customer_self_insert on public.customers for insert to authenticated with check (auth_user_id=(select auth.uid()));
drop policy if exists customer_self_update on public.customers;
create policy customer_self_update on public.customers for update to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
drop policy if exists membership_scoped_read on public.memberships;
create policy membership_scoped_read on public.memberships for select to authenticated using (
  exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=(select auth.uid())) or
  exists(select 1 from public.programs p where p.id=program_id and (select public.owns_business(p.business_id)))
);
drop policy if exists membership_self_insert on public.memberships;
create policy membership_self_insert on public.memberships for insert to authenticated with check (
  exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=(select auth.uid())) and
  exists(select 1 from public.programs p where p.id=program_id and p.active)
);
drop policy if exists visit_scoped_read on public.visits;
create policy visit_scoped_read on public.visits for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists redemption_scoped_read on public.redemptions;
create policy redemption_scoped_read on public.redemptions for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists feedback_scoped_read on public.private_feedback;
create policy feedback_scoped_read on public.private_feedback for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists card_scoped_read on public.physical_cards;
create policy card_scoped_read on public.physical_cards for select to authenticated using (
  (select public.owns_business(business_id)) or exists(
    select 1 from public.memberships m join public.customers c on c.id=m.customer_id
    where m.id=membership_id and c.auth_user_id=(select auth.uid())
  )
);
-- No direct INSERT/UPDATE/DELETE policies for points, cards or feedback. Use RPC below.

-- Espace caisse : caissiers d'un établissement et attribution des passages.
create table if not exists public.cashiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cashiers enable row level security;
alter table public.visits add column if not exists cashier_id uuid references public.cashiers(id) on delete set null;
drop policy if exists cashier_owner_read on public.cashiers;
create policy cashier_owner_read on public.cashiers for select to authenticated using ((select public.owns_business(business_id)));

create or replace function public.add_cashier(p_business uuid,p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  if length(trim(p_name)) not between 2 and 60 then raise exception 'Nom invalide'; end if;
  if (select count(*) from public.cashiers where business_id=p_business and active)>=50 then raise exception 'Limite de caissiers atteinte'; end if;
  insert into public.cashiers(business_id,name) values(p_business,trim(p_name)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_cashier_active(p_cashier uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_business uuid;
begin
  select business_id into v_business from public.cashiers where id=p_cashier;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  update public.cashiers set active=p_active where id=p_cashier;
end $$;

create or replace function public.cashier_stats(p_business uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  return coalesce((select json_agg(r order by r.total desc, r.name) from (
    select c.id,c.name,c.active,
      count(v.id)::int as total,
      count(v.id) filter (where v.created_at > now()-interval '7 days')::int as last7,
      count(v.id) filter (where v.created_at > now()-interval '30 days')::int as last30
    from public.cashiers c left join public.visits v on v.cashier_id=c.id
    where c.business_id=p_business group by c.id) r),'[]'::json);
end $$;

drop function if exists public.record_visit(uuid);
create or replace function public.record_visit(p_membership uuid,p_cashier uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_id uuid;
begin
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  if p_cashier is not null and not exists(select 1 from public.cashiers where id=p_cashier and business_id=v_business and active) then raise exception 'Caissier invalide'; end if;
  -- Anti-fraude : un seul passage validé toutes les 10 minutes par adhésion.
  if exists(select 1 from public.visits where membership_id=p_membership and created_at > now() - interval '10 minutes') then
    raise exception 'Passage déjà enregistré il y a moins de 10 minutes';
  end if;
  insert into public.visits(membership_id,recorded_by,cashier_id) values(p_membership,auth.uid(),p_cashier) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.add_cashier(uuid,text),public.set_cashier_active(uuid,boolean),public.cashier_stats(uuid) from public;
grant execute on function public.add_cashier(uuid,text),public.set_cashier_active(uuid,boolean),public.cashier_stats(uuid) to authenticated;

create or replace function public.redeem_reward(p_membership uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_required integer; v_balance integer; v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select p.business_id,p.required_visits*10 into v_business,v_required from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  select (select count(*)*10 from public.visits where membership_id=p_membership)
    +(select count(*)*5 from public.private_feedback where membership_id=p_membership)
    -(select count(*)*v_required from public.redemptions where membership_id=p_membership) into v_balance;
  if v_balance<v_required then raise exception 'Points insuffisants'; end if;
  insert into public.redemptions(membership_id,redeemed_by) values(p_membership,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_feedback(p_membership uuid,p_rating integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_visit uuid; v_id uuid;
begin
  if p_rating not between 1 and 5 then raise exception 'Note invalide'; end if;
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  select v.id into v_visit from public.visits v where v.membership_id=p_membership
    and not exists(select 1 from public.private_feedback f where f.visit_id=v.id)
    order by v.created_at desc,v.id desc limit 1;
  if v_visit is null then raise exception 'Aucune visite à évaluer'; end if;
  insert into public.private_feedback(membership_id,visit_id,rating) values(p_membership,v_visit,p_rating) returning id into v_id;
  return v_id;
end $$;

create or replace function public.issue_card(p_business uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  insert into public.physical_cards(business_id) values(p_business) returning token into v_token;
  return v_token;
end $$;
create or replace function public.claim_card(p_token uuid,p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_card public.physical_cards%rowtype; v_business uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select * into v_card from public.physical_cards where token=p_token for update;
  select p.business_id into v_business from public.memberships m join public.customers c on c.id=m.customer_id
    join public.programs p on p.id=m.program_id where m.id=p_membership and c.auth_user_id=auth.uid();
  if v_business is null or v_card.id is null or v_card.business_id<>v_business or v_card.status<>'unassigned' then raise exception 'Carte indisponible'; end if;
  update public.physical_cards set status='replaced' where membership_id=p_membership and status='active';
  update public.physical_cards set membership_id=p_membership,status='active' where id=v_card.id;
end $$;
create or replace function public.report_lost_card(p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  update public.physical_cards set status='lost' where membership_id=p_membership and status='active';
end $$;
-- Supprime les données métier; la suppression du compte Auth lui-même nécessite un flux admin séparé.

revoke all on function public.record_visit(uuid,uuid),public.redeem_reward(uuid),public.submit_feedback(uuid,integer),public.issue_card(uuid),public.claim_card(uuid,uuid),public.report_lost_card(uuid) from public;
grant execute on function public.record_visit(uuid,uuid),public.redeem_reward(uuid),public.submit_feedback(uuid,integer),public.issue_card(uuid),public.claim_card(uuid,uuid),public.report_lost_card(uuid) to authenticated;

create or replace function public.card_destination(p_token uuid) returns text
language sql stable security definer set search_path = '' as $$
 select b.slug from public.physical_cards c join public.businesses b on b.id=c.business_id
 where c.token=p_token and (c.status='unassigned' or (c.status='active' and c.membership_id is not null));
$$;
revoke all on function public.card_destination(uuid) from public;
grant execute on function public.card_destination(uuid) to anon,authenticated;

-- Création atomique de l'établissement et de son programme.
create or replace function public.create_business(p_name text,p_slug text,p_reward text,p_visits integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or length(trim(p_name)) not between 2 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 3 and 50
    or length(trim(p_reward)) not between 2 and 100 or p_visits not between 1 and 100 then
    raise exception 'Informations invalides';
  end if;
  if exists(select 1 from public.businesses where owner_id=auth.uid()) then raise exception 'Un commerce existe déjà pour ce compte'; end if;
  insert into public.businesses(owner_id,name,slug) values(auth.uid(),trim(p_name),p_slug) returning id into v_id;
  insert into public.programs(business_id,reward_name,required_visits) values(v_id,trim(p_reward),p_visits);
  return v_id;
end $$;
revoke all on function public.create_business(text,text,text,integer) from public;
grant execute on function public.create_business(text,text,text,integer) to authenticated;

create or replace function public.invalidate_cards_on_membership_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.physical_cards set status='lost' where membership_id=old.id and status='active';
  return old;
end $$;
drop trigger if exists invalidate_cards_on_membership_delete on public.memberships;
create trigger invalidate_cards_on_membership_delete before delete on public.memberships
for each row execute function public.invalidate_cards_on_membership_delete();
revoke all on function public.invalidate_cards_on_membership_delete() from public;

-- Tableau de bord paginé. Les totaux ne dépendent pas de la limite de lignes de l'API.
create or replace function public.business_overview(p_business uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_program public.programs%rowtype; v_clients bigint; v_visits bigint; v_redemptions bigint; v_members jsonb;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  if p_offset < 0 or p_offset > 100000 then raise exception 'Page invalide'; end if;
  select * into v_program from public.programs where business_id=p_business and active limit 1;
  if v_program.id is null then raise exception 'Programme introuvable'; end if;
  select count(*) into v_clients from public.memberships where program_id=v_program.id;
  select count(*) into v_visits from public.visits v join public.memberships m on m.id=v.membership_id where m.program_id=v_program.id;
  select count(*) into v_redemptions from public.redemptions r join public.memberships m on m.id=r.membership_id where m.program_id=v_program.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name,'visits',x.visits,
      'redeemed',x.redeemed,'points',greatest(0,x.visits*10+x.feedback*5-x.redeemed*v_program.required_visits*10)) order by x.joined_at desc,x.id desc),'[]'::jsonb)
  into v_members from (
    select m.id,m.joined_at,c.display_name,
      (select count(*) from public.visits where membership_id=m.id) visits,
      (select count(*) from public.redemptions where membership_id=m.id) redeemed,
      (select count(*) from public.private_feedback where membership_id=m.id) feedback
    from public.memberships m join public.customers c on c.id=m.customer_id
    where m.program_id=v_program.id order by m.joined_at desc,m.id desc limit 25 offset p_offset
  ) x;
  return jsonb_build_object('clients',v_clients,'visits',v_visits,'redemptions',v_redemptions,'members',v_members);
end $$;
revoke all on function public.business_overview(uuid,integer) from public;
grant execute on function public.business_overview(uuid,integer) to authenticated;

create or replace function public.customer_card_summary(p_membership uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_visits bigint; v_feedback bigint; v_redemptions bigint; v_can_rate boolean;
begin
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
    where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  select count(*) into v_visits from public.visits where membership_id=p_membership;
  select count(*) into v_feedback from public.private_feedback where membership_id=p_membership;
  select count(*) into v_redemptions from public.redemptions where membership_id=p_membership;
  select exists(select 1 from public.visits v where v.membership_id=p_membership
    and not exists(select 1 from public.private_feedback f where f.visit_id=v.id)) into v_can_rate;
  return jsonb_build_object('visits',v_visits,'feedback',v_feedback,'redeemed',v_redemptions,'canRate',v_can_rate);
end $$;
revoke all on function public.customer_card_summary(uuid) from public;
grant execute on function public.customer_card_summary(uuid) to authenticated;

-- ============================================================
-- V9 — Profil commerçant enrichi, catalogue de récompenses (paliers),
-- recherche et historique client, réinitialisation de mot de passe.
-- Idempotent : peut être réexécuté sans danger sur une base déjà à jour.
-- ============================================================

alter table public.businesses add column if not exists description text;
alter table public.businesses add column if not exists phone text;
alter table public.businesses add column if not exists hours text;
alter table public.businesses add column if not exists logo_emoji text;
alter table public.businesses add column if not exists accent_color text;
alter table public.businesses drop constraint if exists businesses_accent_color_format;
alter table public.businesses add constraint businesses_accent_color_format check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.businesses drop constraint if exists businesses_description_length;
alter table public.businesses add constraint businesses_description_length check (description is null or length(description) <= 600);
alter table public.businesses drop constraint if exists businesses_phone_length;
alter table public.businesses add constraint businesses_phone_length check (phone is null or length(phone) <= 30);
alter table public.businesses drop constraint if exists businesses_hours_length;
alter table public.businesses add constraint businesses_hours_length check (hours is null or length(hours) <= 400);
alter table public.businesses drop constraint if exists businesses_logo_emoji_length;
alter table public.businesses add constraint businesses_logo_emoji_length check (logo_emoji is null or length(logo_emoji) <= 8);
-- Le nom, la description, le téléphone, l'adresse, les horaires et l'identité visuelle
-- sont modifiables par le propriétaire via la politique business_owner_update déjà en place
-- (elle autorise toute colonne, pas seulement celles d'origine).

-- Catalogue de récompenses : remplace le seuil unique par plusieurs paliers indépendants.
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  points_cost integer not null check (points_cost > 0 and points_cost <= 100000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists rewards_program_idx on public.rewards(program_id);
alter table public.rewards enable row level security;
drop policy if exists reward_public_read on public.rewards;
create policy reward_public_read on public.rewards for select to anon,authenticated using (
  active or (select public.owns_business((select business_id from public.programs where id=program_id)))
);

-- Migration : la récompense unique existante devient la première entrée du catalogue.
insert into public.rewards(program_id,name,points_cost,sort_order)
select p.id,p.reward_name,p.required_visits*10,0 from public.programs p
where not exists(select 1 from public.rewards r where r.program_id=p.id);

alter table public.redemptions add column if not exists reward_id uuid references public.rewards(id) on delete set null;
alter table public.redemptions add column if not exists points_spent integer;
update public.redemptions r set points_spent=coalesce(r.points_spent,(
  select p.required_visits*10 from public.memberships m join public.programs p on p.id=m.program_id where m.id=r.membership_id
)) where r.points_spent is null;
alter table public.redemptions alter column points_spent set not null;

create or replace function public.add_reward(p_program uuid,p_name text,p_points integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_id uuid;
begin
  select business_id into v_business from public.programs where id=p_program;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  if length(trim(p_name)) not between 2 and 100 or p_points is null or p_points<=0 or p_points>100000 then raise exception 'Récompense invalide'; end if;
  insert into public.rewards(program_id,name,points_cost,sort_order)
    values(p_program,trim(p_name),p_points,(select coalesce(max(sort_order),0)+1 from public.rewards where program_id=p_program))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_reward_active(p_reward uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_program uuid; v_business uuid;
begin
  select program_id into v_program from public.rewards where id=p_reward;
  if v_program is null then raise exception 'Récompense introuvable'; end if;
  select business_id into v_business from public.programs where id=v_program;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  update public.rewards set active=p_active where id=p_reward;
end $$;
revoke all on function public.add_reward(uuid,text,integer),public.set_reward_active(uuid,boolean) from public;
grant execute on function public.add_reward(uuid,text,integer),public.set_reward_active(uuid,boolean) to authenticated;

-- redeem_reward : remplace l'ancienne fonction à seuil unique par le catalogue de récompenses.
drop function if exists public.redeem_reward(uuid);
create or replace function public.redeem_reward(p_membership uuid,p_reward uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_cost integer; v_balance integer; v_id uuid; v_reward_program uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  select program_id,points_cost into v_reward_program,v_cost from public.rewards where id=p_reward and active;
  if v_cost is null then raise exception 'Récompense indisponible'; end if;
  if not exists(select 1 from public.memberships m where m.id=p_membership and m.program_id=v_reward_program) then raise exception 'Récompense hors programme'; end if;
  select (select count(*)*10 from public.visits where membership_id=p_membership)
    +(select count(*)*5 from public.private_feedback where membership_id=p_membership)
    -(select coalesce(sum(points_spent),0) from public.redemptions where membership_id=p_membership) into v_balance;
  if v_balance<v_cost then raise exception 'Points insuffisants'; end if;
  insert into public.redemptions(membership_id,redeemed_by,reward_id,points_spent) values(p_membership,auth.uid(),p_reward,v_cost) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.redeem_reward(uuid,uuid) from public;
grant execute on function public.redeem_reward(uuid,uuid) to authenticated;

-- create_business : ajoute la première récompense au catalogue à la création.
create or replace function public.create_business(p_name text,p_slug text,p_reward text,p_visits integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_program uuid;
begin
  if auth.uid() is null or length(trim(p_name)) not between 2 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 3 and 50
    or length(trim(p_reward)) not between 2 and 100 or p_visits not between 1 and 100 then
    raise exception 'Informations invalides';
  end if;
  if exists(select 1 from public.businesses where owner_id=auth.uid()) then raise exception 'Un commerce existe déjà pour ce compte'; end if;
  insert into public.businesses(owner_id,name,slug) values(auth.uid(),trim(p_name),p_slug) returning id into v_id;
  insert into public.programs(business_id,reward_name,required_visits) values(v_id,trim(p_reward),p_visits) returning id into v_program;
  insert into public.rewards(program_id,name,points_cost,sort_order) values(v_program,trim(p_reward),p_visits*10,0);
  return v_id;
end $$;

-- business_overview : ajoute la recherche par nom de client.
drop function if exists public.business_overview(uuid,integer);
create or replace function public.business_overview(p_business uuid,p_offset integer default 0,p_search text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_program public.programs%rowtype; v_clients bigint; v_visits bigint; v_redemptions bigint; v_members jsonb;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  if p_offset < 0 or p_offset > 100000 then raise exception 'Page invalide'; end if;
  select * into v_program from public.programs where business_id=p_business and active limit 1;
  if v_program.id is null then raise exception 'Programme introuvable'; end if;
  select count(*) into v_clients from public.memberships where program_id=v_program.id;
  select count(*) into v_visits from public.visits v join public.memberships m on m.id=v.membership_id where m.program_id=v_program.id;
  select count(*) into v_redemptions from public.redemptions r join public.memberships m on m.id=r.membership_id where m.program_id=v_program.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name,'visits',x.visits,
      'redeemed',x.redeemed,'points',greatest(0,x.visits*10+x.feedback*5-x.spent)) order by x.joined_at desc,x.id desc),'[]'::jsonb)
  into v_members from (
    select m.id,m.joined_at,c.display_name,
      (select count(*) from public.visits where membership_id=m.id) visits,
      (select count(*) from public.redemptions where membership_id=m.id) redeemed,
      (select coalesce(sum(points_spent),0) from public.redemptions where membership_id=m.id) spent,
      (select count(*) from public.private_feedback where membership_id=m.id) feedback
    from public.memberships m join public.customers c on c.id=m.customer_id
    where m.program_id=v_program.id
      and (p_search is null or trim(p_search)='' or c.display_name ilike '%'||trim(p_search)||'%')
    order by m.joined_at desc,m.id desc limit 25 offset p_offset
  ) x;
  return jsonb_build_object('clients',v_clients,'visits',v_visits,'redemptions',v_redemptions,'members',v_members);
end $$;
revoke all on function public.business_overview(uuid,integer,text) from public;
grant execute on function public.business_overview(uuid,integer,text) to authenticated;

-- Historique complet d'un membre (visites, récompenses, avis), pour le commerçant.
create or replace function public.member_history(p_membership uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_business uuid; v_result jsonb;
begin
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_result from (
    select 'visite'::text as kind,v.created_at,c.name as detail
    from public.visits v left join public.cashiers c on c.id=v.cashier_id where v.membership_id=p_membership
    union all
    select 'recompense',r.created_at,coalesce(rw.name,'Récompense')||' (−'||r.points_spent||' pts)'
    from public.redemptions r left join public.rewards rw on rw.id=r.reward_id where r.membership_id=p_membership
    union all
    select 'avis',f.created_at,'Note '||f.rating||'/5'
    from public.private_feedback f where f.membership_id=p_membership
  ) x;
  return v_result;
end $$;
revoke all on function public.member_history(uuid) from public;
grant execute on function public.member_history(uuid) to authenticated;

-- customer_card_summary : expose le total de points dépensés pour calculer le solde face au catalogue.
create or replace function public.customer_card_summary(p_membership uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_visits bigint; v_feedback bigint; v_redemptions bigint; v_spent bigint; v_can_rate boolean;
begin
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
    where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  select count(*) into v_visits from public.visits where membership_id=p_membership;
  select count(*) into v_feedback from public.private_feedback where membership_id=p_membership;
  select count(*) into v_redemptions from public.redemptions where membership_id=p_membership;
  select coalesce(sum(points_spent),0) into v_spent from public.redemptions where membership_id=p_membership;
  select exists(select 1 from public.visits v where v.membership_id=p_membership
    and not exists(select 1 from public.private_feedback f where f.visit_id=v.id)) into v_can_rate;
  return jsonb_build_object('visits',v_visits,'feedback',v_feedback,'redeemed',v_redemptions,'spent',v_spent,'canRate',v_can_rate);
end $$;
revoke all on function public.customer_card_summary(uuid) from public;
grant execute on function public.customer_card_summary(uuid) to authenticated;
