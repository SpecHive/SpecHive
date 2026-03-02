import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
        </div>
        {import.meta.env.MODE === 'development' && this.state.error && (
          <details className="max-w-lg text-left text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-4">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          </details>
        )}
        <Button onClick={this.handleReset}>Try again</Button>
      </div>
    );
  }
}
