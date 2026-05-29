import { Component, type ErrorInfo, type ReactNode } from 'react';
import Logger from '../utils/logger';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Logger.error('ErrorBoundary caught:', error);
    Logger.error('Component stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff4d63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>页面出现了异常</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: 400 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.4rem',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 8,
              background: 'rgba(0,212,255,0.1)',
              color: '#80d8ff',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;