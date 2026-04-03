import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateCvFlow } from "@/components/cv/create-cv/CreateCvFlow";

export default function CreateCvPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white">
        <CreateCvFlow />
      </div>
    </DashboardLayout>
  );
}
