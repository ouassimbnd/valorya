"use client";
import { useEffect,useState,type ReactNode } from "react";
import Link from "next/link";
import { billingRequest,type BillingStatus } from "@/lib/billing-client";
export function BillingGate({children}:{children:ReactNode}){
 const [billing,setBilling]=useState<BillingStatus|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  let stopped=false;let expiry:ReturnType<typeof setTimeout>|undefined;
  const check=async()=>{try{
   const value:BillingStatus=await billingRequest("status");if(stopped)return;
   if(!value.access){location.replace("/business/abonnement");return;}
   setBilling(value);setError("");clearTimeout(expiry);
   if(value.validUntil)expiry=setTimeout(()=>{setBilling(null);location.replace("/business/abonnement");},Math.min(2147483647,Math.max(0,Date.parse(value.validUntil)-Date.now())));
  }catch(e){if(!stopped){setBilling(null);setError(e instanceof Error?e.message:"Accès indisponible.");}}};
  void check();const interval=setInterval(check,60_000);
  return()=>{stopped=true;clearInterval(interval);clearTimeout(expiry);};
 },[]);
 if(!billing)return <div className="container page narrow"><p role="status">{error||"Vérification de votre abonnement…"}</p>{error&&<Link className="btn btn-primary" href="/business/abonnement">Voir mon abonnement</Link>}</div>;
 return <>{billing.status==="trialing"&&<div className="notice notice-ok" style={{margin:16}}>Essai gratuit jusqu’au {new Date(billing.validUntil!).toLocaleDateString("fr-FR")}. <Link href="/business/abonnement">Gérer mon abonnement</Link></div>}{children}</>;
}
