import type { Metadata } from "next";
import Overview from "@/components/business/overview";
export const metadata: Metadata = { title: "Vue d’ensemble" };
export default function Page() { return <Overview />; }
