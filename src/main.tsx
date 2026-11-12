import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { requestPersistentStorage } from './lib/persist.ts'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

void requestPersistentStorage()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
