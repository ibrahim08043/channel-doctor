import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary. Prevents a single rendering crash (e.g. an API
 * returning an object where a string is expected) from white-screening the app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="text-lg font-semibold">Something went wrong</div>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
