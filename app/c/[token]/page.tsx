"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { WalletButton } from "@/components/wallet-button";
import { Icon } from "@/components/icons";
import { configured, errorMessage, supabase } from "@/lib/supabase";
import { computePoints, nextReward, percent, safeColor, shade } from "@/lib/loyalty";
import { resolveType } from "@/lib/business-types";
import { Skeleton } from "@/components/states";

type Reward={id:string;name:string;points_cost:number};
type CardView={membership_id:string;card_token:string;display_name:string;first_name:string;business:{name:string;slug:string;category:string|null;address:string|null;phone:string|null;hours:string|null;description:string|null;logo_emoji:string|null;accent_color:string|null};program:{id:string;required_visits:number};summary:{visits:number;feedback:number;spent:number};rewards:Reward[]};

export default function PublicDigitalCard(){
  const {token}=useParams<{token:string}>();
  const [data,setData]=useState<CardView|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{ if(!configured){setLoading(false);return;} let cancelled=false;(async()=>{try{const r=await supabase().rpc("public_card_view",{p_token:token});if(r.error)throw r.error;if(!r.data)throw new Error("Cette carte est introuvable ou n’est plus disponible.");if(!cancelled)setData(r.data as CardView);}catch(e){if(!cancelled)setError(errorMessage(e));}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true};},[token]);
  const computed=useMemo(()=>{if(!data)return null;const points=computePoints(data.summary.visits,data.summary.feedback,data.summary.spent);const goal=nextReward(data.rewards,points);return{points,goal};},[data]);
  if(!configured)return <div className="pub-page"><div className="card empty"><h2>Carte indisponible</h2><p>Valorya n’est pas encore configuré.</p></div></div>;
  if(loading)return <div className="pub-page"><Skeleton height={420} radius={24}/></div>;
  if(error||!data||!computed)return <div className="pub-page"><div className="card empty" role="alert"><span className="empty-icon danger"><Icon name="alert" size={26}/></span><h3>Carte introuvable</h3><p>{error||"Ce lien n’est plus valide."}</p></div></div>;
  const type=resolveType(data.business.category); const accent=safeColor(data.business.accent_color,"#109B81");
  const style={"--brand-accent":accent,"--brand-dark":shade(accent,-.45)} as CSSProperties;
  const ready=data.rewards.filter(r=>computed.points>=r.points_cost);
  return <div className="pub-page customer-page" style={style}>
    <section className="digital-card card">
      <div className="me-head"><span className="join-emoji">{data.business.logo_emoji||type.emoji}</span><div><small>{data.business.name}</small><h1>Bonjour {data.first_name}<span className="brand-period">.</span></h1></div></div>
      <div className="balance"><strong>{computed.points}</strong><span>points disponibles</span></div>
      {computed.goal?.reward&&<div className="next-reward"><div className="progress"><i style={{width:`${percent(computed.points,computed.goal.reward.points_cost)}%`}}/></div><small>{computed.goal.remaining>0?<>Encore <b>{computed.goal.remaining} pts</b> pour « {computed.goal.reward.name} »</>:<>Récompense disponible : « {computed.goal.reward.name} »</>}</small></div>}
      {ready.length>0&&<div className="notice"><b>Récompense disponible</b><br/>{ready.map(r=>r.name).join(" · ")}</div>}
      <div className="personal-qr"><QRCodeSVG value={`card:${data.card_token}`} size={210} level="M" includeMargin/><strong>Ma carte personnelle</strong><p className="hint">Présentez ce QR au commerçant. Le scan ouvre uniquement votre fiche en caisse ; il n’ajoute aucun point automatiquement.</p></div>
    </section>
    <WalletButton accessToken={token}/>
    <section className="card"><span className="kicker">RETROUVER MA CARTE</span><p className="hint">Conservez cette page dans vos favoris ou ajoutez la carte au Wallet. Si vous la perdez, utilisez « J’ai déjà une carte » avec votre email.</p></section>
  </div>;
}
