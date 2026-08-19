import { Component, type ErrorInfo, type ReactNode } from "react";
import { ERROR_BOUNDARY_STRINGS } from "../constants/ui";

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
      <div className="flex-1 min-h-0 h-full flex items-center justify-center p-6 bg-[#1a202c] overflow-auto">
        <div role="alert" className="max-w-[560px] w-full bg-[#2d3748] border border-[#e53e3e] rounded-lg p-5">
          <h3 className="mb-2 text-sm leading-normal text-[#fc8181]">{ERROR_BOUNDARY_STRINGS.crashTitle(this.props.label)}</h3>
          <p className="mb-3 text-xs leading-normal text-[#a0aec0]">
            {ERROR_BOUNDARY_STRINGS.crashBody}
          </p>
          <pre className="mb-4 p-3 rounded-md bg-[#1a202c] text-xs leading-normal text-[#fc8181] whitespace-pre-wrap [overflow-wrap:anywhere] max-h-[200px] overflow-auto">
            {error.message || String(error)}
          </pre>
          <button
            onClick={this.handleRetry}
            className="px-3.5 py-2 rounded-md bg-[#3182ce] text-[#e2e8f0] text-xs leading-normal font-semibold"
          >
            {ERROR_BOUNDARY_STRINGS.retry}
          </button>
        </div>
      </div>
    );
  }
}
