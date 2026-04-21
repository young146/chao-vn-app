import { registerRootComponent } from 'expo';
import React from 'react';

import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

registerRootComponent(Root);
