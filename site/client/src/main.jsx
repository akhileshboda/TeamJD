import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import App from './App'
import AuthGate from './components/AuthGate'
import { MotionPreferenceProvider } from './motion/MotionPreference'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionPreferenceProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </MotionPreferenceProvider>
    </BrowserRouter>
  </StrictMode>
)
