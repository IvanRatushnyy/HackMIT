import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../design/tokens/index.css'
import './styles/base.css'
import './styles/screens.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
