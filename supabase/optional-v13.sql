-- Fideli v13 — index optionnels pour accélérer la vue d'ensemble (sans changement de données).
-- Sûr à exécuter plusieurs fois. Aucune table, aucune politique et aucune fonction n'est modifiée.
create index if not exists visits_created_at_idx on public.visits(created_at desc);
create index if not exists redemptions_created_at_idx on public.redemptions(created_at desc);
create index if not exists memberships_joined_at_idx on public.memberships(joined_at desc);
