import { Component, type ErrorInfo, type ReactNode } from "react";
import { Btn, Card } from "./ui";
import { captureClientException } from "./sentry";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in the component tree so one broken screen doesn't take down
 * the whole app with a white screen of death. The "Try again" button resets the error
 * boundary without reloading the page (other tabs' state in Context isn't lost).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
    captureClientException(error, { componentStack: info.componentStack ?? undefined });
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Card className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-bold text-lg text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-500">An unexpected error occurred on this screen. Other tabs and data are unaffected.</p>
          <pre className="text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-500 overflow-x-auto">
            {error.message}
          </pre>
          <div className="flex justify-center gap-2">
            <Btn onClick={this.reset}>Try again</Btn>
            <Btn variant="ghost" onClick={() => window.location.assign("/dashboard")}>
              Go to dashboard
            </Btn>
          </div>
        </Card>
      </div>
    );
  }
}
