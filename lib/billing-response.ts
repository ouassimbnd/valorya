import { NextResponse } from "next/server";
import { BillingError } from "./stripe-server";
export const billingJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store",Vary:"Authorization"}});
export const billingFailure=(e:unknown)=>billingJson({error:e instanceof BillingError?e.message:"Abonnement indisponible. Réessayez."},e instanceof BillingError?e.status:503);
