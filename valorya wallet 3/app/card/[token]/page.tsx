"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { useFeedback } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/states";

export default function PhysicalCard() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useFeedback();
  const [slug, setSlug] = useState("");
  const [membership, setMembership] = useState("");
  const [merchant, setMerchant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const client = supabase();
        const { data, error } = await client.rpc("card_destination", { p_token: token });
        if (error) throw error;
        if (!data) { if (!cancelled) { setInvalid(true); setLoading(false); } return; }
        if (cancelled) return;
        setSlug(data);
        const { data: card } = await client.from("physical_cards").select("membership_id,business_id").eq("token", token).maybeSingle();
        if (card?.membership_id) {
          setMembership(card.membership_id);
          const { data: { user } } = await client.auth.getUser();
          if (user) {
            const { data: owner } = await client.from("businesses").select("id").eq("id", card.business_id).eq("owner_id", user.id).maybeSingle();
            if (!cancelled) setMerchant(Boolean(owner));
          }
        }
        if (!cancelled) setLoading(false);
      } catch (e) { if (!cancelled) { toast(errorMessage(e), "error"); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [token, toast]);

  const visit = async () => {
    if (busy) return;
    setBusy(true);
    try { const { error } = await supabase().rpc("record_visit", { p_membership: membership }); if (error) throw error; setDone(true); toast("Visite ajoutée au compte du client."); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <div className="pub-page">
      <div className="card empty">
        {loading ? <Skeleton height={120} /> : invalid || !slug ? (
          <><span className="empty-icon danger"><Icon name="alert" size={26} /></span><h3>Carte introuvable ou désactivée</h3><p>Ce QR code n’est plus valide. Demandez une nouvelle carte au commerçant.</p><Link className="btn btn-ghost" href="/customer/login">Retrouver ma carte</Link></>
        ) : (
          <>
            <span className="empty-icon"><Icon name="card" size={26} /></span>
            <h3>Votre carte de fidélité</h3>
            <p>{membership ? "Cette carte est déjà reliée à un client." : "Reliez cette carte à votre compte pour cumuler des points à chaque passage."}</p>
            {!membership && <Link className="btn btn-primary btn-xl" href={`/join/${slug}?card=${encodeURIComponent(token)}`}>Associer ma carte</Link>}
            {membership && <Link className="btn btn-ghost" href="/customer/login">Voir mes points</Link>}
            {merchant && membership && (
              <div className="scan-action">
                <p className="hint">Vous gérez cet établissement.</p>
                <button type="button" className="btn btn-primary" onClick={() => void visit()} disabled={busy || done}>{done ? "Visite enregistrée" : busy ? "Enregistrement…" : "Enregistrer la visite"}</button>
                <Link className="text-link" href={`/business/caisse?membership=${membership}`}>Ouvrir en caisse →</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
