"use client";
import { supabase } from "./supabase";
export type BillingStatus={access:boolean;plan:string|null;cycle:string|null;status:string;validUntil:string|null;trialEndsAt:string|null;trialUsed:boolean;cancelAtPeriodEnd:boolean;canManage:boolean};
export async function billingRequest(path:string,method="GET",body?:unknown){
 const {data:{session}}=await supabase().auth.getSession();
 if(!session){location.replace("/business/login");throw new Error("Connexion requise.");}
 const response=await fetch("/api/billing/"+path,{method,headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(55_000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||"Service indisponible.");return data;
}
