import { Component, type ErrorInfo, type ReactNode } from "react";
import { Btn, Card } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Ловить помилки рендеру в дереві компонентів, щоб один зламаний екран не клав
 * увесь застосунок білим екраном. Кнопка «Спробувати ще раз» скидає межу помилки
 * без перезавантаження сторінки (стан інших вкладок у Context не втрачається).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Необроблена помилка рендеру:", error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Card className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-bold text-lg text-slate-900">Щось пішло не так</h2>
          <p className="text-sm text-slate-500">Сталася непередбачена помилка на цьому екрані. Інші вкладки й дані не постраждали.</p>
          <pre className="text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-500 overflow-x-auto">
            {error.message}
          </pre>
          <div className="flex justify-center gap-2">
            <Btn onClick={this.reset}>Спробувати ще раз</Btn>
            <Btn variant="ghost" onClick={() => window.location.assign("/dashboard")}>
              На дашборд
            </Btn>
          </div>
        </Card>
      </div>
    );
  }
}
