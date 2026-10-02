import { billingUser,withBilling,startCheckout,BillingError } from "@/lib/billing-server";
import { isPlan,isCycle } from "@/lib/billing-plans";
import { billingJson,billingFailure } from "@/lib/billing-response";
export const runtime="nodejs";export const maxDuration=60;
export async function POST(request:Request){try{
 const user=await billingUser(request);const body=await request.json().catch(()=>null);
 if(!isPlan(body?.plan)||!isCycle(body?.cycle))throw new BillingError(400,"Choisissez un forfait et une période valides.");
 const url=await withBilling(user.id,(admin,row)=>startCheckout(admin,row,body.plan,body.cycle,user.email||""));
 return billingJson({url});
}catch(e){return billingFailure(e);}}
