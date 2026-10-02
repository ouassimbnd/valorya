-- Valorya — parcours client sans création de compte au premier scan.
-- Migration NON destructive : conserve commerces, clients, points et historiques.
-- À exécuter APRÈS schema.sql et upgrade-digital-cards-wallet.sql.

create extension if not exists pgcrypto;

alter table public.customers add column if not exists first_name text;
alter table public.customers add column if not exists last_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists marketing_email boolean not null default false;
alter table public.customers add column if not exists marketing_push boolean not null default false;
alter table public.customers add column if not exists privacy_accepted_at timestamptz;

alter table public.memberships add column if not exists public_token uuid default gen_random_uuid();
update public.memberships set public_token = gen_random_uuid() where public_token is null;
alter table public.memberships alter column public_token set default gen_random_uuid();
alter table public.memberships alter column public_token set not null;
create unique index if not exists memberships_public_token_unique on public.memberships(public_token);

create index if not exists customers_email_lower_idx on public.customers((lower(email))) where email is not null;

comment on column public.memberships.public_token is
  'Jeton secret permettant au client d’ouvrir sa carte digitale sans mot de passe. Ne jamais afficher dans le QR de caisse.';

-- Inscription publique : un nouveau client obtient sa carte immédiatement.
-- Si la carte existe déjà pour cet email et ce programme, aucun jeton existant n’est révélé :
-- le client doit utiliser « Retrouver ma carte » par email.
create or replace function public.join_program_public(
  p_program uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text default null,
  p_marketing_email boolean default false,
  p_marketing_push boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_first text := trim(coalesce(p_first_name,''));
  v_last text := trim(coalesce(p_last_name,''));
  v_email text := lower(trim(coalesce(p_email,'')));
  v_phone text := nullif(trim(coalesce(p_phone,'')),'');
  v_customer uuid;
  v_membership uuid;
  v_public_token uuid;
  v_business uuid;
  v_slug text;
begin
  if length(v_first) not between 2 and 60 or length(v_last) not between 2 and 80 then
    raise exception 'Nom ou prénom invalide';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse email invalide';
  end if;
  if v_phone is not null and length(v_phone) > 30 then raise exception 'Téléphone invalide'; end if;

  select p.business_id,b.slug into v_business,v_slug
  from public.programs p join public.businesses b on b.id=p.business_id
  where p.id=p_program and p.active=true;
  if v_business is null then raise exception 'Programme indisponible'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_program::text||':'||v_email,0));

  select m.id into v_membership
  from public.memberships m join public.customers c on c.id=m.customer_id
  where m.program_id=p_program and lower(c.email)=v_email
  limit 1;

  if v_membership is not null then
    return jsonb_build_object('status','existing','business_slug',v_slug);
  end if;

  insert into public.customers(
    display_name,first_name,last_name,email,phone,marketing_email,marketing_push,privacy_accepted_at
  ) values (
    left(v_first||' '||v_last,120),v_first,v_last,v_email,v_phone,
    coalesce(p_marketing_email,false),coalesce(p_marketing_push,false),now()
  ) returning id into v_customer;

  insert into public.memberships(customer_id,program_id)
  values(v_customer,p_program)
  returning id,public_token into v_membership,v_public_token;

  return jsonb_build_object(
    'status','created',
    'membership_id',v_membership,
    'access_token',v_public_token,
    'business_slug',v_slug
  );
end $$;
revoke all on function public.join_program_public(uuid,text,text,text,text,boolean,boolean) from public;
grant execute on function public.join_program_public(uuid,text,text,text,text,boolean,boolean) to anon,authenticated;

-- Lecture limitée d’UNE carte à partir de son jeton secret.
create or replace function public.public_card_view(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'membership_id',m.id,
    'joined_at',m.joined_at,
    'card_token',m.card_token,
    'display_name',c.display_name,
    'first_name',coalesce(c.first_name,c.display_name),
    'business',jsonb_build_object(
      'name',b.name,'slug',b.slug,'category',b.category,'address',b.address,
      'phone',b.phone,'hours',b.hours,'description',b.description,
      'logo_emoji',b.logo_emoji,'accent_color',b.accent_color
    ),
    'program',jsonb_build_object('id',p.id,'required_visits',p.required_visits),
    'summary',jsonb_build_object(
      'visits',(select count(*) from public.visits where membership_id=m.id),
      'feedback',(select count(*) from public.private_feedback where membership_id=m.id),
      'spent',(select coalesce(sum(points_spent),0) from public.redemptions where membership_id=m.id)
    ),
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'points_cost',r.points_cost) order by r.points_cost)
      from public.rewards r where r.program_id=p.id and r.active=true),'[]'::jsonb)
  ) into v_result
  from public.memberships m
  join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id
  join public.businesses b on b.id=p.business_id
  where m.public_token=p_token and p.active=true;

  return v_result;
end $$;
revoke all on function public.public_card_view(uuid) from public;
grant execute on function public.public_card_view(uuid) to anon,authenticated;

-- Association optionnelle d’une ancienne carte physique à la nouvelle adhésion sans compte client.
create or replace function public.claim_card_public(p_card_token uuid,p_access_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_membership uuid;
  v_business uuid;
  v_card_business uuid;
  v_status text;
begin
  select m.id,p.business_id into v_membership,v_business
  from public.memberships m join public.programs p on p.id=m.program_id
  where m.public_token=p_access_token;
  if v_membership is null then raise exception 'Carte client invalide'; end if;

  select business_id,status into v_card_business,v_status from public.physical_cards where token=p_card_token for update;
  if v_card_business is null or v_card_business<>v_business or v_status<>'unassigned' then raise exception 'Carte indisponible'; end if;
  update public.physical_cards set membership_id=v_membership,status='active' where token=p_card_token;
end $$;
revoke all on function public.claim_card_public(uuid,uuid) from public;
grant execute on function public.claim_card_public(uuid,uuid) to anon,authenticated;

-- Lorsqu’un client utilise plus tard « Retrouver ma carte », son email Auth permet de rattacher
-- les cartes créées anonymement sans exposer de jeton à quelqu’un connaissant seulement l’email.
create or replace function public.claim_customer_by_email() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_target uuid;
  v_source record;
begin
  if v_uid is null then raise exception 'Accès refusé'; end if;
  select lower(email) into v_email from auth.users where id=v_uid;
  if v_email is null then raise exception 'Email indisponible'; end if;

  select id into v_target from public.customers where auth_user_id=v_uid limit 1;
  if v_target is null then
    select id into v_target from public.customers where auth_user_id is null and lower(email)=v_email order by created_at limit 1;
    if v_target is null then return null; end if;
    update public.customers set auth_user_id=v_uid where id=v_target;
  end if;

  for v_source in select id from public.customers where id<>v_target and auth_user_id is null and lower(email)=v_email
  loop
    update public.memberships m set customer_id=v_target
      where m.customer_id=v_source.id
      and not exists(select 1 from public.memberships already where already.customer_id=v_target and already.program_id=m.program_id);
    delete from public.memberships m where m.customer_id=v_source.id;
    delete from public.customers where id=v_source.id;
  end loop;

  update public.customers set email=coalesce(email,v_email) where id=v_target;
  return v_target;
end $$;
revoke all on function public.claim_customer_by_email() from public;
grant execute on function public.claim_customer_by_email() to authenticated;
