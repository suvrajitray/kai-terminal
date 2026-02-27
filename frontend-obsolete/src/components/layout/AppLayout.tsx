import PnlBar from "@/components/common/PnlBar";
import TopNav from "./TopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-gray-200">
      <TopNav />
      <main className="p-8">{children}</main>
      <PnlBar />
    </div>
  );
}
