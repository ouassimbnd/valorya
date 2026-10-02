import { billingAdmin,billingUser,publicBilling,withBilling,reconcile } from "@/lib/billing-server";
import { billingJson,billingFailure } from "@/lib/billing-response";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=60;
export async function GET(request:Request){try{
 const user=await billingUser(request);const admin=billingAdmin();
 const r=await admin.from("merchant_billing").select("*").eq("owner_id",user.id).maybeSingle();if(r.error)throw r.error;
 if(r.data?.stripe_customer && (!r.data.synced_at || Date.now()-Date.parse(r.data.synced_at)>300_000)) {
  return billingJson(await withBilling(user.id,async(a,row)=>publicBilling(await reconcile(a,row))));
 }
 return billingJson(publicBilling(r.data));
}catch(e){return billingFailure(e);}}
export async function POST(request:Request){try{
 const user=await billingUser(request);
 return billingJson(await withBilling(user.id,async(admin,row)=>publicBilling(await reconcile(admin,row))));
}catch(e){return billingFailure(e);}}
