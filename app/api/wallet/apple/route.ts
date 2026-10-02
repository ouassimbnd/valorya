import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({configured:false},{headers:{"Cache-Control":"no-store"}});}
export async function POST(){return NextResponse.json({error:"Cette ancienne route Wallet est désactivée. Utilisez le bouton Wallet de votre carte Valorya."},{status:410,headers:{"Cache-Control":"no-store"}});}
