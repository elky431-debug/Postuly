"use client";

import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/**
 * Route /dashboard — layout dark premium + contenu métier.
 */
export default function DashboardRoute() {
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
