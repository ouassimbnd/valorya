import { timingSafeEqual } from "node:crypto";
import { billingAdmin,withBilling,reconcile } from "@/lib/billing-server";
import { billingJson,billingFailure } from "@/lib/billing-response";
export const runtime="nodejs";export const maxDuration=60;export const dynamic="force-dynamic";
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET||"";const expected=Buffer.from("Bearer "+secret),actual=Buffer.from(request.headers.get("authorization")||"");
 if(secret.length<32||expected.length!==actual.length||!timingSafeEqual(expected,actual))return billingJson({error:"Accès refusé."},401);
 try{
  const q=await billingAdmin().from("merchant_billing").select("owner_id").not("stripe_customer","is",null).order("synced_at",{ascending:true,nullsFirst:true}).limit(1);
  if(q.error)throw q.error;
  if(q.data?.[0])await withBilling(q.data[0].owner_id,async(admin,row)=>{await reconcile(admin,row);});
  return billingJson({processed:q.data?.length||0});
 }catch(e){return billingFailure(e);}
}
