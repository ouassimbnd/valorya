import type { Metadata } from "next";
import Clients from "@/components/business/clients";
export const metadata: Metadata = { title: "Clients" };
export default function Page() { return <Clients />; }
