import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function AppLayout() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
