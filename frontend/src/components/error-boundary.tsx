import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[KAI Terminal] Uncaught error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="size-10 text-destructive" />
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              An unexpected error occurred. You can try refreshing the page or clicking the button below to recover.
            </p>
            <pre className="mt-2 max-w-lg overflow-auto rounded-md bg-muted px-4 py-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 size-4" />
              Reload page
            </Button>
            <Button onClick={this.reset}>Try to recover</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
