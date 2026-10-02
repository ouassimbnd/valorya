import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOrGetPass, passcreatorConfigured, passcreatorHealth } from "@/lib/passcreator";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const noCache={"Cache-Control":"private, no-store",Vary:"Authorization"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:noCache});

export async function GET(){const health=await passcreatorHealth();return json(health,health.configured&& !health.connected?502:200);}

export async function POST(request:NextRequest){
 if(!passcreatorConfigured())return json({error:"Wallet non configuré. Ajoutez PASSCREATOR_API_KEY et PASSCREATOR_TEMPLATE_ID dans Vercel."},503);
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL; const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!supabaseUrl||!supabaseKey)return json({error:"Supabase n’est pas configuré."},503);
 let body:unknown; try{body=await request.json();}catch{return json({error:"Demande invalide."},400)}
 const membershipId=(body as {membershipId?:unknown})?.membershipId; const accessToken=(body as {accessToken?:unknown})?.accessToken;
 try{
   const base=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}});
   let payload:{membership_id:string;card_token:string;display_name:string;email?:string|null;business:{name:string}}|null=null;

   if(typeof accessToken==="string"&&UUID.test(accessToken)){
     const r=await base.rpc("public_card_view",{p_token:accessToken}); if(r.error)throw r.error; if(!r.data)return json({error:"Carte introuvable."},404);
     const d=r.data as {membership_id:string;card_token:string;display_name:string;business:{name:string}};
     payload={...d};
   }else{
     const bearer=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
     if(!bearer)return json({error:"Carte invalide."},401);
     if(typeof membershipId!=="string"||!UUID.test(membershipId))return json({error:"Carte invalide."},400);
     const client=createClient(supabaseUrl,supabaseKey,{global:{headers:{Authorization:`Bearer ${bearer}`}},auth:{persistSession:false,autoRefreshToken:false}});
     const{data:{user},error:authError}=await client.auth.getUser(bearer); if(authError||!user)return json({error:"Votre session a expiré. Reconnectez-vous."},401);
     const customer=await client.from("customers").select("id,display_name,email").eq("auth_user_id",user.id).maybeSingle(); if(customer.error)throw customer.error; if(!customer.data)return json({error:"Profil client introuvable."},404);
     const membership=await client.from("memberships").select("id,card_token,program:programs(business:businesses(name))").eq("id",membershipId).eq("customer_id",customer.data.id).maybeSingle(); if(membership.error)throw membership.error; if(!membership.data)return json({error:"Carte introuvable."},404);
     const program=membership.data.program as unknown as {business:{name:string}}|null; if(!program?.business?.name)return json({error:"Programme indisponible."},404);
     payload={membership_id:membership.data.id,card_token:membership.data.card_token,display_name:customer.data.display_name,email:customer.data.email||user.email,business:{name:program.business.name}};
   }

   if(!payload.card_token)return json({error:"Jeton de carte manquant. Exécutez les migrations Valorya."},409);
   // QR non navigable : un appareil photo standard n’envoie plus vers une page Vercel protégée.
   // La caisse Valorya comprend directement le format card:<uuid>.
   const barcodeValue=`card:${payload.card_token}`;
   const pass=await createOrGetPass({membershipId:payload.membership_id,barcodeValue,customerName:payload.display_name,businessName:payload.business.name,email:payload.email||undefined});
   return json({url:pass.downloadPage,appleUrl:pass.appleUrl||pass.downloadPage,googleUrl:pass.googleUrl||pass.downloadPage});
 }catch(error){const message=error instanceof Error?error.message:"Impossible de préparer la carte Wallet.";return json({error:message},502)}
}
