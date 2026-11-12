import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import { migrateModelSettings } from './db/db.ts'
import { requestPersistentStorage } from './lib/persist.ts'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

void requestPersistentStorage()
void migrateModelSettings().catch(() => {
  // Settings still resolve the chain on read; it will be stored on the next save.
})

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
