import { billingUser,withBilling,BillingError } from "@/lib/billing-server";
import { stripe,appOrigin } from "@/lib/stripe-server";
import { billingJson,billingFailure } from "@/lib/billing-response";
export const runtime="nodejs";
export async function POST(request:Request){try{
 const user=await billingUser(request);return billingJson(await withBilling(user.id,async(_admin,row)=>{
  if(!row.stripe_customer)throw new BillingError(400,"Aucun abonnement à gérer.");
  return stripe<{url:string}>("/billing_portal/sessions","POST",{customer:row.stripe_customer,return_url:appOrigin()+"/business/abonnement"});
 }));
}catch(e){return billingFailure(e);}}
