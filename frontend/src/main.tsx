import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '')
const defaultApiBase = window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:3002'
  : 'https://mtaaexpress-sut2.onrender.com'
const apiBaseUrl = configuredApiBase || defaultApiBase
console.info('[Mtaaexpress Frontend] API base URL:', apiBaseUrl)

const originalFetch = window.fetch.bind(window)
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    return originalFetch(`${apiBaseUrl}${input}`, init)
  }

  return originalFetch(input, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
