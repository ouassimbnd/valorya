"use client";
import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "./icons";

type Links={url:string;appleUrl:string;googleUrl:string};

type Props={membershipId?:string;accessToken?:string};

/**
 * Crée au maximum un pass Passcreator par adhésion.
 * Le parcours public utilise accessToken ; le parcours client connecté conserve membershipId.
 */
export function WalletButton({membershipId,accessToken}:Props){
 const[configured,setConfigured]=useState<boolean|null>(null);const[busy,setBusy]=useState<""|"apple"|"google"|"universal">("");const[message,setMessage]=useState("");const[serviceError,setServiceError]=useState("");const[links,setLinks]=useState<Links|null>(null);const[isApple,setIsApple]=useState(false);
 useEffect(()=>{setIsApple(/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent));const controller=new AbortController();fetch("/api/wallet/passcreator",{signal:controller.signal}).then(async r=>{const data=await r.json().catch(()=>({}));return data}).then(data=>{if(!controller.signal.aborted){setConfigured(Boolean(data.configured&&data.connected));setServiceError(typeof data.error==="string"?data.error:"")}}).catch(()=>{if(!controller.signal.aborted){setConfigured(false);setServiceError("Connexion au service Wallet impossible.")}});return()=>controller.abort();},[]);
 const getLinks=async()=>{if(links)return links;let headers:Record<string,string>={"Content-Type":"application/json"};let body:Record<string,string>={};if(accessToken){body={accessToken};}else{const{data:{session}}=await supabase().auth.getSession();if(!session)throw new Error("Reconnectez-vous pour ajouter votre carte.");headers.Authorization=`Bearer ${session.access_token}`;if(!membershipId)throw new Error("Carte invalide.");body={membershipId};}const response=await fetch("/api/wallet/passcreator",{method:"POST",headers,body:JSON.stringify(body)});const data=await response.json().catch(()=>({})) as Partial<Links>&{error?:string};if(!response.ok||!data.url)throw new Error(data.error||"Carte Wallet indisponible.");const next={url:data.url,appleUrl:data.appleUrl||data.url,googleUrl:data.googleUrl||data.url} as Links;setLinks(next);return next;};
 const open=async(kind:"apple"|"google"|"universal")=>{if(busy)return;setBusy(kind);setMessage("");try{const pass=await getLinks();const target=kind==="apple"?pass.appleUrl:kind==="google"?pass.googleUrl:pass.url;location.assign(target);}catch(error){setMessage(errorMessage(error));setBusy("");}};
 const checking=configured===null;
 return <div className="wallet-add"><div className="wallet-add-head"><span className="wallet-badge"><Icon name="wallet" size={20}/></span><div><strong>Ajouter ma carte au téléphone</strong><small>Votre carte Valorya peut être ajoutée au Wallet sans créer de nouveau compte.</small></div></div><div className="wallet-buttons">{isApple?<button type="button" className="btn btn-dark" disabled={!configured||Boolean(busy)} onClick={()=>void open("apple")}><Icon name="wallet" size={18}/>{busy==="apple"?"Préparation…":"Ajouter à Apple Wallet"}</button>:<button type="button" className="btn btn-dark" disabled={!configured||Boolean(busy)} onClick={()=>void open("google")}><Icon name="wallet" size={18}/>{busy==="google"?"Préparation…":"Ajouter à Google Wallet"}</button>}<button type="button" className="btn btn-soft" disabled={!configured||Boolean(busy)} onClick={()=>void open("universal")}><Icon name="share" size={18}/>{busy==="universal"?"Préparation…":"Autres options Wallet"}</button></div><p className="hint">{checking?"Vérification du service Wallet…":configured?"Le QR Wallet contient uniquement un identifiant aléatoire de carte. Aucun nom, email ou solde n’est encodé.":"Le service Wallet n’est pas encore activé. Votre carte Valorya reste disponible sur cette page."}</p>{serviceError&&<p className="notice notice-error" role="status">{serviceError}</p>}{message&&<p className="notice notice-error" role="status">{message}</p>}</div>;
}
