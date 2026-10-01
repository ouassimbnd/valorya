-- Valorya : synchronisation persistante Passcreator. Installation additive et réexécutable.
-- Prérequis : schema.sql, upgrade-digital-cards-wallet.sql, upgrade-frictionless-client.sql.
begin;
create schema if not exists valorya_private;
revoke all on schema valorya_private from public, anon, authenticated;

-- Pas de FK sur membership_id : conserver une tâche de suppression après effacement du client.
-- Aucun nom, email, solde ou jeton d'accès client n'est stocké dans cette file.
create table if not exists public.wallet_passes (
  membership_id uuid primary key,
  business_id uuid not null,
  provider_id text unique,
  template_id text,
  download_page text,
  apple_url text,
  google_url text,
  operation text not null default 'sync' check (operation in ('sync','delete')),
  desired_version bigint not null default 1,
  synced_version bigint not null default 0,
  lock_token uuid,
  locked_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.wallet_passes enable row level security;
revoke all on public.wallet_passes from public, anon, authenticated;
grant select, insert, update, delete on public.wallet_passes to service_role;
create index if not exists wallet_pending_idx on public.wallet_passes(next_attempt_at)
where desired_version > synced_version;
create index if not exists wallet_business_idx on public.wallet_passes(business_id);

-- RPC uniquement serveur. Les endpoints vérifient l'identité AVANT cet appel.
create or replace function public.wallet_request_pass(p_membership uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_business uuid;
begin
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id
  where m.id=p_membership and p.active;
  if v_business is null then raise exception 'Carte indisponible'; end if;
  insert into public.wallet_passes(membership_id,business_id) values(p_membership,v_business)
  on conflict(membership_id) do update set desired_version=public.wallet_passes.desired_version+1,
    next_attempt_at=now() where public.wallet_passes.locked_until is null or public.wallet_passes.locked_until < now();
end $$;

create or replace function public.wallet_claim_job(p_membership uuid default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_row public.wallet_passes%rowtype;
begin
  select * into v_row from public.wallet_passes
  where desired_version>synced_version and next_attempt_at<=now()
    and (locked_until is null or locked_until<now())
    and (p_membership is null or membership_id=p_membership)
  order by next_attempt_at,created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update public.wallet_passes set lock_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',attempts=attempts+1
  where membership_id=v_row.membership_id returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- Instantané cohérent : le navigateur ne fournit jamais le solde ou le nom à l'API Wallet.
create or replace function public.wallet_snapshot(p_membership uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('membershipId',m.id,'businessId',b.id,'active',p.active,
    'cardToken',m.card_token,'customerName',c.display_name,'firstName',coalesce(c.first_name,c.display_name),
    'lastName',coalesce(c.last_name,''),'email',coalesce(c.email,''),'businessName',b.name,
    'joinedAt',m.joined_at,
    'points',greatest(0,(select count(*)*10 from public.visits where membership_id=m.id)
      +(select count(*)*5 from public.private_feedback where membership_id=m.id)
      -(select coalesce(sum(points_spent),0) from public.redemptions where membership_id=m.id)),
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('name',r.name,'points_cost',r.points_cost) order by r.points_cost,r.id)
      from public.rewards r where r.program_id=m.program_id and r.active),'[]'::jsonb))
  from public.memberships m join public.customers c on c.id=m.customer_id
    join public.programs p on p.id=m.program_id join public.businesses b on b.id=p.business_id
  where m.id=p_membership;
$$;

create or replace function public.wallet_finish_job(p_membership uuid,p_lock uuid,p_version bigint,
  p_links jsonb default null,p_error text default null,p_deleted boolean default false) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  -- Un travailleur expiré ne peut pas acquitter le travail d'un autre.
  perform 1 from public.wallet_passes where membership_id=p_membership and lock_token=p_lock for update;
  if not found then return false; end if;
  if p_error is not null then
    update public.wallet_passes set lock_token=null,locked_until=null,last_error=left(p_error,160),
      next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer)
    where membership_id=p_membership;
  elsif p_deleted then
    delete from public.wallet_passes where membership_id=p_membership;
  else
    update public.wallet_passes set provider_id=p_links->>'identifier',template_id=p_links->>'templateId',
      download_page=p_links->>'downloadPage',apple_url=p_links->>'appleUrl',google_url=p_links->>'googleUrl',
      synced_version=p_version,synced_at=now(),last_error=null,attempts=0,lock_token=null,locked_until=null,next_attempt_at=now()
    where membership_id=p_membership;
  end if;
  return true;
end $$;

revoke all on function public.wallet_request_pass(uuid),public.wallet_claim_job(uuid),public.wallet_snapshot(uuid),
  public.wallet_finish_job(uuid,uuid,bigint,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.wallet_request_pass(uuid),public.wallet_claim_job(uuid),public.wallet_snapshot(uuid),
  public.wallet_finish_job(uuid,uuid,bigint,jsonb,text,boolean) to service_role;

-- Fonctions de déclenchement non exposées par l'API, sans accès direct client.
create or replace function valorya_private.wallet_enqueue_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op<>'INSERT' then v_old=old.membership_id; end if;
  if tg_op<>'DELETE' then v_new=new.membership_id; end if;
  update public.wallet_passes set desired_version=desired_version+1,next_attempt_at=now()
  where membership_id in (v_old,v_new) and operation='sync';
  return null;
end $$;
create or replace function valorya_private.wallet_enqueue_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.wallet_passes set desired_version=desired_version+1,next_attempt_at=now(),
    operation=case when tg_op='DELETE' then 'delete' else operation end
  where membership_id=old.id;
  return case when tg_op='DELETE' then old else new end;
end $$;
create or replace function valorya_private.wallet_enqueue_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.wallet_passes w set desired_version=w.desired_version+1,next_attempt_at=now()
  from public.memberships m where m.id=w.membership_id and m.customer_id=new.id and w.operation='sync';
  return null;
end $$;
create or replace function valorya_private.wallet_enqueue_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.wallet_passes set desired_version=desired_version+1,next_attempt_at=now()
  where business_id=new.id and operation='sync';
  return null;
end $$;
create or replace function valorya_private.wallet_enqueue_program() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old uuid; v_new uuid;
begin
  if tg_table_name='programs' then v_new=new.id;
  else
    if tg_op<>'INSERT' then v_old=old.program_id; end if;
    if tg_op<>'DELETE' then v_new=new.program_id; end if;
  end if;
  update public.wallet_passes w set desired_version=w.desired_version+1,next_attempt_at=now()
  from public.memberships m where w.membership_id=m.id and m.program_id in(v_old,v_new) and w.operation='sync';
  return null;
end $$;
revoke all on all functions in schema valorya_private from public,anon,authenticated;

drop trigger if exists valorya_wallet_visits on public.visits;
create trigger valorya_wallet_visits after insert or update or delete on public.visits for each row execute function valorya_private.wallet_enqueue_change();
drop trigger if exists valorya_wallet_redemptions on public.redemptions;
create trigger valorya_wallet_redemptions after insert or update or delete on public.redemptions for each row execute function valorya_private.wallet_enqueue_change();
drop trigger if exists valorya_wallet_feedback on public.private_feedback;
create trigger valorya_wallet_feedback after insert or update or delete on public.private_feedback for each row execute function valorya_private.wallet_enqueue_change();
drop trigger if exists valorya_wallet_membership_delete on public.memberships;
create trigger valorya_wallet_membership_delete before delete on public.memberships for each row execute function valorya_private.wallet_enqueue_member();
drop trigger if exists valorya_wallet_membership_update on public.memberships;
create trigger valorya_wallet_membership_update after update of card_token,customer_id,program_id on public.memberships for each row execute function valorya_private.wallet_enqueue_member();
drop trigger if exists valorya_wallet_customer on public.customers;
create trigger valorya_wallet_customer after update of display_name,first_name,last_name,email on public.customers for each row execute function valorya_private.wallet_enqueue_profile();
drop trigger if exists valorya_wallet_business on public.businesses;
create trigger valorya_wallet_business after update of name on public.businesses for each row execute function valorya_private.wallet_enqueue_business();
drop trigger if exists valorya_wallet_program on public.programs;
create trigger valorya_wallet_program after update of active on public.programs for each row execute function valorya_private.wallet_enqueue_program();
drop trigger if exists valorya_wallet_rewards on public.rewards;
create trigger valorya_wallet_rewards after insert or update or delete on public.rewards for each row execute function valorya_private.wallet_enqueue_program();

-- Sérialiser les validations simultanées AVANT de vérifier le délai de dix minutes.
create or replace function public.record_visit(p_membership uuid,p_cashier uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Accès refusé'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  if p_cashier is not null and not exists(select 1 from public.cashiers where id=p_cashier and business_id=v_business and active) then raise exception 'Caissier invalide'; end if;
  if exists(select 1 from public.visits where membership_id=p_membership and created_at>now()-interval '10 minutes') then
    raise exception 'Passage déjà enregistré il y a moins de 10 minutes';
  end if;
  insert into public.visits(membership_id,recorded_by,cashier_id) values(p_membership,auth.uid(),p_cashier) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_visit(uuid,uuid) from public,anon;
grant execute on function public.record_visit(uuid,uuid) to authenticated;
commit;
