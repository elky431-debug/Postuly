import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FranceTravailPage } from "@/components/france-travail/FranceTravailPage";

export const metadata = { title: "France Travail – Postuly" };

export default function Page() {
  return (
    <DashboardLayout>
      <FranceTravailPage />
    </DashboardLayout>
  );
}
