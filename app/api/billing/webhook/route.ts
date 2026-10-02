import { verifyStripeEvent } from "@/lib/stripe-server";
import { billingAdmin,withBilling,reconcile,BillingError } from "@/lib/billing-server";
import { billingJson,billingFailure } from "@/lib/billing-response";
export const runtime="nodejs";export const maxDuration=60;
export async function POST(request:Request){try{
 const raw=await request.text();if(raw.length>1000000)throw new BillingError(413,"Événement trop volumineux.");
 const event=verifyStripeEvent(raw,request.headers.get("stripe-signature"));
 if(!/^(checkout\.session\.|customer\.subscription\.|invoice\.)/.test(event.type))return billingJson({received:true});
 const customer=event.data.object.customer;const id=typeof customer==="string"?customer:customer?.id;
 if(!id)return billingJson({received:true});
 const result=await billingAdmin().from("merchant_billing").select("owner_id").eq("stripe_customer",id).maybeSingle();
 if(result.error)throw result.error;
 if(result.data)await withBilling(result.data.owner_id,async(admin,row)=>{await reconcile(admin,row);});
 return billingJson({received:true});
}catch(e){return billingFailure(e);}}
