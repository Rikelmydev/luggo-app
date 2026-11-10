import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { router } from './router'
import { AuthProvider } from './state/auth'
import { BagProvider } from './state/bag'
import { ToastProvider } from './components/ui/Toast'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
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
  </StrictMode>,
)
