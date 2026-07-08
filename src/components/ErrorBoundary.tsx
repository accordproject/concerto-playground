import { Component, type ErrorInfo, type ReactNode } from "react";
import "./errors.css";

interface ErrorBoundaryProps {
  /** Panel name shown in the fallback, e.g. "Text Editor". */
  label: string;
  /**
   * When any of these values change, a caught error is cleared and the
   * children are re-rendered. Pass the panel's main input (e.g. the CTO
   * source) so fixing the input automatically retries the panel.
   */
  resetKeys?: unknown[];
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function resetKeysChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (prev === next) return false;
  if (!prev || !next || prev.length !== next.length) return true;
  return prev.some((v, i) => !Object.is(v, next[i]));
}

/**
 * Catches render errors thrown by a panel and shows a recovery UI instead of
 * letting the whole page unmount (React removes the entire tree on an
 * uncaught render error).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}] crashed while rendering:`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <div role="alert" className="error-boundary-card">
          <h3 className="error-boundary-title">The {this.props.label} panel crashed</h3>
          <p className="error-boundary-text">
            The rest of the playground still works and your schema text is unchanged.
            The error below may point at what went wrong.
          </p>
          <pre className="error-boundary-message">{error.message || String(error)}</pre>
          <button onClick={this.handleRetry} className="error-boundary-retry">
            Try again
          </button>
        </div>
      </div>
    );
  }
}
