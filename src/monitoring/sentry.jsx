/**
 * src/monitoring/sentry.jsx — RootErrorBoundary для React 19 (@sentry/react).
 */

import React from 'react';
import * as Sentry from '@sentry/react';

/**
 * Корневой Error Boundary в ретро-стиле игрового автомата
 */
export function RootErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary
      beforeCapture={(scope) => {
        scope.setTag('errorBoundary', 'true');
        scope.setTag('component', 'RootErrorBoundary');
      }}
      fallback={({ resetError }) => (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0c',
          color: '#ff4d4d',
          fontFamily: 'monospace',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '480px',
            border: '2px solid #ff4d4d',
            padding: '32px',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(255, 77, 77, 0.4)',
          }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px', letterSpacing: '2px' }}>
              💥 SYSTEM FAILURE
            </h1>
            <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
              Произошла непредвиденная ошибка автомата. Отчёт о сбое отправлен в систему мониторинга.
            </p>
            <button
              type="button"
              onClick={() => {
                resetError();
                window.location.reload();
              }}
              style={{
                background: '#ff4d4d',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'monospace',
                letterSpacing: '1px',
              }}
            >
              ПЕРЕЗАГРУЗИТЬ АВТОМАТ
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
