import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { RootErrorBoundary } from './monitoring/sentry.jsx'
import { initClientMonitoring } from './monitoring/init.js'

initClientMonitoring();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

