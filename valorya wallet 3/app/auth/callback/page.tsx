"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "@/components/icons";

export default function AuthCallback() {
  const [error, setError] = useState("");
  useEffect(() => {
    const run = async () => {
      try {
        const query = new URLSearchParams(location.search);
        const code = query.get("code");
        if (code) { const { error: e } = await supabase().auth.exchangeCodeForSession(code); if (e) throw e; }
        const { data: { user }, error: e } = await supabase().auth.getUser();
        if (e || !user) throw e || new Error("Lien expiré. Demandez un nouveau lien.");
        const next = query.get("next") || "/customer";
        location.replace(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/customer");
      } catch (err) { setError(errorMessage(err)); }
    };
    void run();
  }, []);
  return (
    <div className="pub-page"><div className="card empty" role="status">
      {error ? <><span className="empty-icon danger"><Icon name="alert" size={26} /></span><h3>Connexion impossible</h3><p>{error}</p><Link className="btn btn-primary" href="/customer/login">Demander un nouveau lien</Link></>
        : <><span className="spinner" aria-hidden="true" /><h3>Connexion en cours…</h3><p>Vérification de votre lien.</p></>}
    </div></div>
  );
}
