import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata: Metadata = {
  title: "診断｜NEXUS.path",
  robots: { index: false, follow: false },
};

export default function DiagnosisPage() {
  return <Wizard />;
}
