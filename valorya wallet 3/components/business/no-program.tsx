"use client";
import { useState } from "react";
import { EmptyState } from "../states";
import { useFeedback } from "../feedback";
import { createProgram, type MerchantState } from "@/lib/use-merchant";
import { errorMessage } from "@/lib/supabase";

/** Affiché quand un commerce n’a aucun programme actif (données anciennes) : un clic pour repartir. */
export function NoProgram({ merchant }: { merchant: MerchantState }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();
  const create = async () => {
    if (!merchant.business || busy) return;
    setBusy(true);
    try {
      await createProgram(merchant.business, merchant.type);
      toast("Programme créé avec des récompenses adaptées à votre activité.");
      await merchant.reload();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return (
    <div className="ws-page">
      <div className="card">
        <EmptyState icon="gift" title="Aucun programme actif" action={<button type="button" className="btn btn-primary" onClick={create} disabled={busy}>{busy ? "Création…" : "Créer mon programme"}</button>}>
          Votre commerce n’a pas encore de programme de fidélité. Nous en créons un avec des récompenses adaptées à votre métier ({merchant.type.short.toLowerCase()}) ; vous pourrez tout modifier ensuite.
        </EmptyState>
      </div>
    </div>
  );
}
