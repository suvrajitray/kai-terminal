import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./header";

export function AppLayout() {
  const { pathname } = useLocation();
  const isFullBleed = pathname.startsWith("/terminal");

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className={isFullBleed ? undefined : "px-4 py-6 sm:px-6 lg:px-8"}>
        <Outlet />
      </main>
    </div>
  );
}
