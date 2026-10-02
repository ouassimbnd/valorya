import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { walletConfigured } from "@/lib/wallet-config";
import { createWalletPass } from "@/lib/wallet-pass";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noCache={"Cache-Control":"private, no-store","Vary":"Authorization"};
const json=(error:string,status:number)=>NextResponse.json({error},{status,headers:noCache});
export async function GET(){return NextResponse.json({configured:walletConfigured()},{headers:noCache});}
export async function POST(request:NextRequest){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return json("Connectez-vous pour ajouter votre carte.",401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return json("Service indisponible.",503);
 let body:unknown;try{body=await request.json();}catch{return json("Demande invalide.",400);}
 const id=(body as {membershipId?:unknown})?.membershipId;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json("Carte invalide.",400);
 try{
  // Use the caller's token, not the service role. RLS applies to every query.
  const c=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await c.auth.getUser(token);
  if(authError||!user)return json("Votre session a expiré. Reconnectez-vous.",401);
  const {data:customer,error:ce}=await c.from("customers").select("id,display_name").eq("auth_user_id",user.id).maybeSingle();
  if(ce)throw ce;if(!customer)return json("Carte introuvable.",404);
  const {data:m,error:me}=await c.from("memberships").select("id,card_token,program:programs(business:businesses(name,accent_color))").eq("id",id).eq("customer_id",customer.id).maybeSingle();
  if(me)throw me;if(!m)return json("Carte introuvable.",404);
  if(!walletConfigured())return json("Apple Wallet n’est pas encore activé par Valorya. Votre carte reste disponible dans votre espace.",503);
  const program=m.program as unknown as {business:{name:string;accent_color?:string|null}}|null;
  if(!program?.business)return json("Ce programme n’est plus disponible.",404);
  const bytes=createWalletPass({membershipId:m.id,cardToken:m.card_token,customerName:customer.display_name,businessName:program.business.name,accentColor:program.business.accent_color});
  return new NextResponse(new Uint8Array(bytes),{headers:{...noCache,"Content-Type":"application/vnd.apple.pkpass","Content-Disposition":'attachment; filename="valorya.pkpass"',"X-Content-Type-Options":"nosniff"}});
 }catch{return json("Impossible de générer la carte. Réessayez ou contactez Valorya.",500);}
}
