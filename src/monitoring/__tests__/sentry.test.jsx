import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import * as Sentry from '@sentry/react';
import { RootErrorBoundary } from '../sentry.jsx';
import { initClientMonitoring } from '../init.js';

vi.mock('@sentry/react', () => {
  return {
    init: vi.fn(),
    ErrorBoundary: ({ children }) => <div data-testid="sentry-eb">{children}</div>,
  };
});

describe('Client Monitoring (src/monitoring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создает элемент RootErrorBoundary с дочерними элементами', () => {
    const element = React.createElement(RootErrorBoundary, null, React.createElement('div', null, 'Arcade Ready'));
    expect(element.type).toBe(RootErrorBoundary);
    expect(element.props.children).toBeDefined();
  });

  it('не инициализирует Sentry без VITE_SENTRY_DSN в тестовом режиме', () => {
    initClientMonitoring();
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
