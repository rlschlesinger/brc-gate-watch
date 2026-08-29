import Dashboard from "./Dashboard";
import historical from "@/data/historical.json";
import type { Historical } from "@/lib/historical";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Dashboard historical={historical as unknown as Historical} />;
}
