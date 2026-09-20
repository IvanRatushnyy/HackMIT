import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../design/tokens/index.css'
import './styles/base.css'
import './styles/splash.css'
import './styles/entry.css'
import './styles/working.css'
import './styles/detail.css'
import './styles/pathway.css'
import './styles/sources.css'
import './styles/export.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
