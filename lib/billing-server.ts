import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { BILLING_PLANS, TRIAL_DAYS, type Plan, type Cycle } from "./billing-plans";
import { stripe, appOrigin, BillingError, stripeReady } from "./stripe-server";
export { BillingError } from "./stripe-server";
export type BillingRow = { owner_id:string; stripe_customer:string|null; subscription_id:string|null; plan:Plan|null; cycle:Cycle|null;
 status:string; valid_until:string|null; trial_used_at:string|null; trial_ends_at:string|null; cancel_at_period_end:boolean;
 checkout_id:string|null; checkout_nonce:string; checkout_plan:Plan|null; checkout_cycle:Cycle|null; lock_token:string; synced_at:string|null };
export type Subscription = { id:string; created:number; customer:string; status:string; trial_start:number|null; trial_end:number|null;
 cancel_at_period_end:boolean; cancel_at:number|null; ended_at:number|null; pause_collection:unknown;
 items:{ data:{ quantity:number; current_period_end:number; price:{id:string;unit_amount:number;currency:string;recurring:{interval:string;interval_count:number}|null} }[] };
 latest_invoice:{status:string; paid:boolean; lines:{data:{period:{end:number}}[]}}|string|null };
export function billingAdmin() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new BillingError(503,"Configuration de l’abonnement incomplète.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function billingUser(request:Request) {
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new BillingError(401,"Connectez-vous à votre espace commerçant.");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new BillingError(503,"Service indisponible.");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)throw new BillingError(401,"Reconnectez-vous.");
 return user;
}
export function priceId(plan:Plan,cycle:Cycle) {
 const key=`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
 const value=process.env[key]; if(!value||!value.startsWith("price_"))throw new BillingError(503,"Ce tarif n’est pas encore activé.");
 return value;
}
function planFor(price:string) {
 for(const plan of BILLING_PLANS)for(const cycle of ["month","year"] as const) {
  if(process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_${cycle.toUpperCase()}`]===price)return {plan:plan.id,cycle};
 }
 return null;
}
const iso=(seconds:number)=>new Date(seconds*1000).toISOString();
export function subscriptionState(sub:Subscription,row:BillingRow,now=Date.now()) {
 const item=sub.items.data[0], mapping=item?planFor(item.price.id):null;
 let until:number|null=null;
 const cap=row.trial_ends_at?Date.parse(row.trial_ends_at)/1000:sub.trial_end;
 if(mapping && sub.items.data.length===1 && item.quantity===1 && !sub.pause_collection) {
  if(sub.status==="trialing" && sub.trial_end && cap) until=Math.min(sub.trial_end,cap,(sub.trial_start || sub.created)+TRIAL_DAYS*86400);
  const invoice=sub.latest_invoice;
  if(sub.status==="active" && invoice && typeof invoice!=="string" && invoice.status==="paid" && invoice.paid) {
   // The invoice must cover this period: the initial zero-value trial invoice cannot extend access.
   const coveredUntil=Math.max(0,...invoice.lines.data.map(l=>l.period.end));
   until=Math.min(item.current_period_end,coveredUntil);
  }
  if(until && sub.cancel_at)until=Math.min(until,sub.cancel_at);
 }
 return {subscription_id:sub.id,plan:mapping?.plan||null,cycle:mapping?.cycle||null,status:sub.status,
  valid_until:until?iso(until):null,cancel_at_period_end:sub.cancel_at_period_end,
  trial_used_at:row.trial_used_at || iso(sub.trial_start || sub.created),
  trial_ends_at:row.trial_ends_at || (sub.trial_end?iso(Math.min(sub.trial_end,(sub.trial_start || sub.created)+TRIAL_DAYS*86400)):null),
  synced_at:new Date(now).toISOString()};
}
export function hasAccess(row:Pick<BillingRow,"status"|"valid_until">|null,now=Date.now()) {
 return Boolean(row && ["trialing","active"].includes(row.status) && row.valid_until && Date.parse(row.valid_until)>now);
}
export async function saveBilling(admin:SupabaseClient,row:BillingRow,patch:Record<string,unknown>) {
 const result=await admin.from("merchant_billing").update(patch).eq("owner_id",row.owner_id).eq("lock_token",row.lock_token).select("owner_id").maybeSingle();
 if(result.error||!result.data)throw new BillingError(503,"La mise à jour de l’abonnement n’a pas été confirmée.");
 Object.assign(row,patch);
}
export async function withBilling<T>(owner:string,fn:(admin:SupabaseClient,row:BillingRow)=>Promise<T>):Promise<T> {
 const admin=billingAdmin();const claim=await admin.rpc("billing_acquire",{p_owner:owner});
 if(claim.error)throw new BillingError(503,"Installation SQL des abonnements à vérifier.");
 if(!claim.data)throw new BillingError(409,"Une demande est déjà en cours. Réessayez dans quelques secondes.");
 const row=claim.data as BillingRow;
 try{return await fn(admin,row);}finally{await admin.rpc("billing_release",{p_owner:owner,p_lock:row.lock_token});}
}
// Always retrieve the canonical Stripe state UNDER the per-owner lock. Old or duplicate webhooks cannot roll it back.
export async function reconcile(admin:SupabaseClient,row:BillingRow) {
 if(!row.stripe_customer)return row;
 const result=await stripe<{data:Subscription[];has_more:boolean}>(`/subscriptions?customer=${encodeURIComponent(row.stripe_customer)}&status=all&limit=100&expand[]=data.latest_invoice`);
 if(result.has_more)throw new BillingError(503,"Historique d’abonnement à vérifier par l’administrateur.");
 const current=result.data.filter(s=>!["canceled","incomplete_expired"].includes(s.status));
 if(current.length>1){await saveBilling(admin,row,{status:"duplicate",valid_until:null});throw new BillingError(409,"Plusieurs abonnements détectés. Contactez l’assistance.");}
 const sub=current[0] || result.data.sort((a,b)=>b.created-a.created)[0];
 if(sub)await saveBilling(admin,row,subscriptionState(sub,row));
 else await saveBilling(admin,row,{status:"none",valid_until:null,synced_at:new Date().toISOString()});
 return row;
}
export function publicBilling(row:BillingRow|null) {
 return {access:hasAccess(row),plan:row?.plan||null,cycle:row?.cycle||null,status:row?.status||"none",
  validUntil:row?.valid_until||null,trialEndsAt:row?.trial_ends_at||null,trialUsed:Boolean(row?.trial_used_at),
  cancelAtPeriodEnd:row?.cancel_at_period_end||false,canManage:Boolean(row?.stripe_customer)};
}
export async function startCheckout(admin:SupabaseClient,row:BillingRow,plan:Plan,cycle:Cycle,email:string) {
 if(!stripeReady())throw new BillingError(503,"Le service de paiement n’est pas encore activé.");
 if(!["true","false"].includes(process.env.STRIPE_AUTOMATIC_TAX||""))throw new BillingError(503,"Le réglage fiscal du paiement reste à configurer.");
 const origin=appOrigin();
 if(row.stripe_customer)await reconcile(admin,row);
 if(!["none","canceled","incomplete_expired"].includes(row.status))throw new BillingError(409,"Un abonnement existe déjà. Utilisez « Gérer mon abonnement ».");
 if(!row.stripe_customer){
  const customer=await stripe<{id:string}>("/customers","POST",{email,"metadata[valorya_owner]":row.owner_id},`valorya-customer-${row.owner_id}`);
  await saveBilling(admin,row,{stripe_customer:customer.id});
 }
 if(row.checkout_id){
  const session=await stripe<{status:string;url:string|null}>(`/checkout/sessions/${encodeURIComponent(row.checkout_id)}`);
  if(session.status==="open") {
   if(row.checkout_plan===plan&&row.checkout_cycle===cycle&&session.url)return session.url;
   await stripe(`/checkout/sessions/${encodeURIComponent(row.checkout_id)}/expire`,"POST",{});
  }
  if(session.status==="complete") {await reconcile(admin,row);if(!["canceled","incomplete_expired"].includes(row.status))throw new BillingError(409,"Paiement reçu ou en vérification. Cliquez sur Actualiser mon statut.");}
  await saveBilling(admin,row,{checkout_id:null,checkout_nonce:randomUUID(),checkout_plan:null,checkout_cycle:null});
 }
 // Keep a durable idempotency key after a timeout; never create an uncontrolled second Checkout.
 if(row.checkout_plan && (row.checkout_plan!==plan||row.checkout_cycle!==cycle))throw new BillingError(409,"Reprenez d’abord la demande du forfait précédent.");
 const id=priceId(plan,cycle);
 const price=await stripe<{active:boolean;currency:string;unit_amount:number;tax_behavior:string;recurring:{interval:string;interval_count:number}|null}>(`/prices/${encodeURIComponent(id)}`);
 const offer=BILLING_PLANS.find(p=>p.id===plan)!;
 if(!price.active||price.currency!=="eur"||price.unit_amount!==(cycle==="month"?offer.monthly:offer.yearly)*100||price.recurring?.interval!==cycle||price.recurring.interval_count!==1||price.tax_behavior!=="exclusive")throw new BillingError(503,"Le prix Stripe ne correspond pas à l’offre affichée. Configuration à vérifier.");
 await saveBilling(admin,row,{checkout_plan:plan,checkout_cycle:cycle});
 const params:Record<string,string>={mode:"subscription",customer:row.stripe_customer!,"line_items[0][price]":id,"line_items[0][quantity]":"1",
  success_url:origin+"/business/abonnement?success=1",cancel_url:origin+"/business/abonnement?cancel=1",
  payment_method_collection:"always","payment_method_types[0]":"card",billing_address_collection:"required",
  "customer_update[address]":"auto","customer_update[name]":"auto","tax_id_collection[enabled]":"true",locale:"fr",
  "automatic_tax[enabled]":process.env.STRIPE_AUTOMATIC_TAX==="true"?"true":"false",
  "consent_collection[terms_of_service]":"required",
  "subscription_data[metadata][valorya_owner]":row.owner_id,
  "metadata[valorya_owner]":row.owner_id,
  "custom_text[submit][message]":row.trial_used_at?"Abonnement payant dès confirmation. Renouvellement automatique, résiliation depuis votre espace.":"15 jours gratuits, puis prélèvement automatique au tarif affiché. Résiliez avant la fin de l’essai pour ne pas être débité."};
 if(!row.trial_used_at){params["subscription_data[trial_period_days]"]="15";params["subscription_data[trial_settings][end_behavior][missing_payment_method]"]="cancel";}
 const checkout=await stripe<{id:string;url:string}>("/checkout/sessions","POST",params,`valorya-checkout-${row.checkout_nonce}`);
 await saveBilling(admin,row,{checkout_id:checkout.id});
 return checkout.url;
}
