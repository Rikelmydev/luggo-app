import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { router } from './router'
import { bootstrap } from './services/remote'
import { REMOTE } from './services/supabase'
import { AuthProvider } from './state/auth'
import { BagProvider } from './state/bag'
import { ToastProvider } from './components/ui/Toast'
import './styles/global.css'

const app = (
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <BagProvider>
              <RouterProvider router={router} />
            </BagProvider>
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
)

const root = createRoot(document.getElementById('root')!)
if (REMOTE) {
  // Espera o estoque chegar do banco (no máximo alguns segundos) para não mostrar malas esgotadas por engano.
  const timeout = new Promise((resolve) => setTimeout(resolve, 5000))
  Promise.race([bootstrap(), timeout])
    .catch(() => {})
    .finally(() => root.render(app))
} else {
  root.render(app)
}
