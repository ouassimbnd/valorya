import type { Metadata } from "next";
import Profile from "@/components/business/profile";
export const metadata: Metadata = { title: "Mon établissement" };
export default function Page() { return <Profile />; }
