-- Installer APRES wallet-personnalisation.sql. Réexécutable, aucun effacement des clients.
begin;
create schema if not exists valorya_private;
revoke all on schema valorya_private from public,anon,authenticated;
create table if not exists public.merchant_billing (
 owner_id uuid primary key references auth.users(id),
 stripe_customer text unique, subscription_id text unique,
 plan text check(plan in ('essentiel','wallet')), cycle text check(cycle in ('month','year')),
 status text not null default 'none', valid_until timestamptz,
 trial_used_at timestamptz, trial_ends_at timestamptz,
 cancel_at_period_end boolean not null default false,
 checkout_id text, checkout_nonce uuid not null default gen_random_uuid(),
 checkout_plan text, checkout_cycle text,
 lock_token uuid, locked_until timestamptz,
 synced_at timestamptz
);
alter table public.merchant_billing enable row level security;
revoke all on public.merchant_billing from public,anon,authenticated;
grant select,insert,update,delete on public.merchant_billing to service_role;
-- Aucun droit d’écriture client sur le forfait, les dates ou le statut.
create or replace function public.billing_acquire(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.merchant_billing%rowtype;
begin
 insert into public.merchant_billing(owner_id) values(p_owner) on conflict do nothing;
 update public.merchant_billing set lock_token=gen_random_uuid(),locked_until=now()+interval '2 minutes'
 where owner_id=p_owner and (locked_until is null or locked_until<now()) returning * into r;
 if not found then return null; end if; return to_jsonb(r);
end $$;
create or replace function public.billing_release(p_owner uuid,p_lock uuid) returns void
language sql security invoker set search_path='' as $$
 update public.merchant_billing set lock_token=null,locked_until=null where owner_id=p_owner and lock_token=p_lock;
$$;
revoke all on function public.billing_acquire(uuid),public.billing_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_acquire(uuid),public.billing_release(uuid,uuid) to service_role;

create or replace function valorya_private.billing_access(p_owner uuid,p_wallet boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.merchant_billing where owner_id=p_owner
 and status in ('trialing','active') and valid_until>now()
 and (not p_wallet or plan='wallet'));
$$;
revoke all on function valorya_private.billing_access(uuid,boolean) from public,anon,authenticated;
-- Les fonctions métier existantes et leurs policies utilisent déjà owns_business.
create or replace function public.owns_business(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.businesses where id=p_id and owner_id=auth.uid()
 and valorya_private.billing_access(owner_id));
$$;
create or replace function public.merchant_can_read_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.programs p on p.id=m.program_id
 join public.businesses b on b.id=p.business_id where m.customer_id=p_customer
 and b.owner_id=auth.uid() and valorya_private.billing_access(b.owner_id));
$$;
-- Reste de la sécurité : aussi les RPC publiques et les écritures directes.
create or replace function valorya_private.billing_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_owner uuid;
begin
 if tg_table_name='businesses' then
   v_owner=new.owner_id;
   if tg_op='UPDATE' and old.owner_id is distinct from new.owner_id then raise exception 'Changement de propriétaire non autorisé'; end if;
 elsif tg_table_name in ('programs','cashiers','physical_cards') then
   v_business=new.business_id;
   -- Autoriser l’invalidation lors d’une suppression client (conservation des données).
   if tg_table_name='physical_cards' and tg_op='UPDATE' then
     if new.membership_id is null and old.membership_id is not null then return new; end if;
   end if;
 elsif tg_table_name in ('memberships','rewards') then
   select business_id into v_business from public.programs where id=new.program_id;
 else
   select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=new.membership_id;
 end if;
 if v_owner is null then select owner_id into v_owner from public.businesses where id=v_business; end if;
 if not valorya_private.billing_access(v_owner) then raise exception 'Abonnement requis : choisissez un forfait ou régularisez votre paiement'; end if;
 return new;
end $$;
revoke all on function valorya_private.billing_guard() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['businesses','programs','cashiers','physical_cards','memberships','rewards','visits','redemptions','private_feedback'] loop
 execute format('drop trigger if exists billing_access_guard on public.%I',t);
 execute format('create trigger billing_access_guard before insert or update on public.%I for each row execute function valorya_private.billing_guard()',t);
 end loop;
end $$;

-- Autorisation Wallet dérivée de l’abonnement du commerce, jamais du navigateur.
create or replace function public.billing_wallet_access(p_membership uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.memberships m join public.programs p on p.id=m.program_id
 join public.businesses b on b.id=p.business_id join public.merchant_billing mb on mb.owner_id=b.owner_id
 where m.id=p_membership and mb.plan='wallet' and mb.status in ('active','trialing') and mb.valid_until>now());
$$;
revoke all on function public.billing_wallet_access(uuid) from public,anon,authenticated;
grant execute on function public.billing_wallet_access(uuid) to service_role;
-- Limite commerciale : 200 adhésions ayant demandé une carte Wallet par établissement.
-- Conserver les réservations même après suppression d’un pass empêche le contournement par recréation.
create table if not exists public.wallet_allocations (
 membership_id uuid primary key, business_id uuid not null,
 created_at timestamptz not null default now()
);
create index if not exists wallet_allocations_business_idx on public.wallet_allocations(business_id);
alter table public.wallet_allocations enable row level security;
revoke all on public.wallet_allocations from public,anon,authenticated;
grant select,insert on public.wallet_allocations to service_role;
insert into public.wallet_allocations(membership_id,business_id) select membership_id,business_id from public.wallet_passes on conflict do nothing;
create or replace function public.billing_reserve_wallet(p_membership uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v_business uuid;
begin
 if not public.billing_wallet_access(p_membership) then raise exception 'Forfait Wallet actif requis'; end if;
 select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_business::text,27));
 if exists(select 1 from public.wallet_allocations where membership_id=p_membership) then return; end if;
 if (select count(*) from public.wallet_allocations where business_id=v_business)>=200 then raise exception 'Limite de 200 cartes Wallet atteinte'; end if;
 insert into public.wallet_allocations(membership_id,business_id) values(p_membership,v_business);
end $$;
revoke all on function public.billing_reserve_wallet(uuid) from public,anon,authenticated;
grant execute on function public.billing_reserve_wallet(uuid) to service_role;
commit;
