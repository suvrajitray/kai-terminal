import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <TooltipProvider delayDuration={300}>
        <App />
        <Toaster
          position="bottom-right"
          expand
          closeButton
          visibleToasts={8}
          duration={8000}
          gap={8}
        />
        </TooltipProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
