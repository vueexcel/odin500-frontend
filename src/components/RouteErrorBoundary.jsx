import { Component } from 'react';

export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="route-error-boundary">
          <h1 className="route-error-boundary__title">Something went wrong</h1>
          <p className="route-error-boundary__msg">
            {String(this.state.error?.message || 'Unexpected error')}
          </p>
          <button
            type="button"
            className="route-error-boundary__retry"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
