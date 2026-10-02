import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publishable||!service)return NextResponse.json({error:"Suppression indisponible"},{status:503});
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return NextResponse.json({error:"Connexion requise"},{status:401});
 const publicClient=createClient(url,publishable,{auth:{persistSession:false}});
 const {data:{user},error}=await publicClient.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:"Session invalide"},{status:401});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const billing=await admin.from("merchant_billing").select("owner_id,stripe_customer").eq("owner_id",user.id).maybeSingle();
 if(billing.error)return NextResponse.json({error:"Vérification de l’abonnement indisponible"},{status:503});
 if(billing.data?.stripe_customer)return NextResponse.json({error:"Ce compte possède un dossier d’abonnement commerçant. Résiliez depuis Abonnement, puis contactez l’assistance pour clôturer votre compte et ses données."},{status:409});
 if(billing.data){const empty=await admin.from("merchant_billing").delete().eq("owner_id",user.id).is("stripe_customer",null);if(empty.error)return NextResponse.json({error:"Clôture indisponible"},{status:503});}
 const deleted=await admin.auth.admin.deleteUser(user.id);
 if(deleted.error)return NextResponse.json({error:"Suppression impossible"},{status:500});
 return NextResponse.json({ok:true});
}
