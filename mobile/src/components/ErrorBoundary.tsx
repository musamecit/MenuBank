import React, { Component, ErrorInfo, ReactNode } from 'react';
import CrashScreen from './CrashScreen';
import { setCrashError } from '../utils/crashHandler';

type Props = { children: ReactNode };

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    setCrashError(error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
