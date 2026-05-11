import { AppLayout } from "@/components/layout/AppLayout";
import { FinnWidget } from "@/components/finn/FinnWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      {children}
      <FinnWidget />
    </AppLayout>
  );
}
