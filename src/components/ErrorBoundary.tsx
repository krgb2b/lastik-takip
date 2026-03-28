"use client";

import React, { ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught:", error);
      console.error("Error Info:", errorInfo);
    }

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2m0-14a9 9 0 110 18 9 9 0 010-18zm0 0a9 9 0 110 18 9 9 0 010-18z"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Bir hata oluştu
          </h1>
          <p className="mb-6 text-slate-600">
            Sayfa yüklenirken beklenmeyen bir hata meydana geldi. Lütfen aşağıdaki
            buton ile tekrar deneyin veya destek ile iletişime geçin.
          </p>

          {isDev && (
            <div className="mb-6 rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-sm font-mono font-semibold text-slate-700">
                Hata Detayı (Geliştirici Modu):
              </p>
              <p className="text-sm text-slate-600">{error.message}</p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-600">
                    Stack trace
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-700">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onReset}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
            >
              Tekrar Deneyin
            </button>
            <a
              href="/"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
            >
              Ana Sayfa
            </a>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">
              Hata devam ederse, lütfen{" "}
              <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                destek ekibimize
              </a>{" "}
              başvurun.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
