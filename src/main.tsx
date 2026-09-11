import { StrictMode } from 'react';
import React, { type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface BoundaryProps {
  children: ReactNode;
}

class RootErrorBoundary extends React.Component<BoundaryProps, { error: Error | null }> {
  declare props: BoundaryProps;
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('Planner crashed:', error);
  }

  render() {
    const { children } = this.props;
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
          <p className="text-sm font-bold text-neutral-700">页面出错了</p>
          <p className="max-w-md text-xs leading-5 text-neutral-400">{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" onClick={() => window.location.reload()} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700">刷新页面</button>
        </div>
      );
    }
    return children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
