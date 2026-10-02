import type { Metadata } from "next";
import JoinClient from "./join-client";
export const metadata: Metadata = { title: "Rejoindre le programme de fidélité" };
export default function Join() { return <JoinClient />; }
