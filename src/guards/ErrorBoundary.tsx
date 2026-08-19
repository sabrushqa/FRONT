import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16, color: '#64748b'
        }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Une erreur est survenue lors du chargement de cette page.</p>
          <button
            type="button"
            style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: '#f8fafc' }}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
