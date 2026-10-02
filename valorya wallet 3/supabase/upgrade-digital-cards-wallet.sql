-- Valorya — carte digitale automatique par adhésion.
-- Migration NON destructive : elle conserve les commerces, clients, points et historiques existants.

create extension if not exists pgcrypto;

-- Chaque adhésion reçoit automatiquement un jeton QR aléatoire.
-- Ce jeton n'est ni un email, ni un nom, ni un solde : il sert uniquement à retrouver la fiche en caisse.
alter table public.memberships
  add column if not exists card_token uuid default gen_random_uuid();

update public.memberships
set card_token = gen_random_uuid()
where card_token is null;

alter table public.memberships
  alter column card_token set default gen_random_uuid();
alter table public.memberships
  alter column card_token set not null;

create unique index if not exists memberships_card_token_unique
  on public.memberships(card_token);

comment on column public.memberships.card_token is
  'Jeton aléatoire de la carte digitale. Ne contient aucune donnée personnelle et ne donne aucun droit de modification.';

-- Lecture déjà protégée par la policy membership_scoped_read :
-- le client voit ses adhésions et le commerçant voit uniquement celles de ses programmes.
