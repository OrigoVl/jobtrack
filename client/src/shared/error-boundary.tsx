import { Component, type ErrorInfo, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { Btn, Card } from "./ui";
import { captureClientException } from "./sentry";

interface Props extends WithTranslation<["chrome", "common"]> {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in the component tree so one broken screen doesn't take down
 * the whole app with a white screen of death. The "Try again" button resets the error
 * boundary without reloading the page (other tabs' state in Context isn't lost).
 *
 * A class component (React's error boundary API requires it — no hook equivalent), so `t` is
 * plugged in via the `withTranslation` HOC below rather than the usual `useTranslation` hook.
 */
class ErrorBoundaryBase extends Component<Props, State> {
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
    const { t } = this.props;
    if (!error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Card className="text-center space-y-3">
          <h2 className="font-bold text-lg text-ink">{t("errorBoundary.title")}</h2>
          <p className="text-sm text-ink-dim">{t("errorBoundary.hint")}</p>
          <pre className="text-left text-xs bg-surface-2 border border-grid rounded-lg p-2.5 text-ink-dim overflow-x-auto">
            {error.message}
          </pre>
          <div className="flex justify-center gap-2">
            <Btn onClick={this.reset}>{t("errorBoundary.tryAgain")}</Btn>
            <Btn variant="ghost" onClick={() => window.location.assign("/dashboard")}>
              {t("errorBoundary.goToDashboard")}
            </Btn>
          </div>
        </Card>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation(["chrome", "common"])(ErrorBoundaryBase);
