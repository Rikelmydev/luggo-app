import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { CheckCircle, WarningCircle, X } from './icons'
import styles from './Toast.module.css'

type Tone = 'ok' | 'error'
interface ToastItem { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } }
type Notify = (message: string, opts?: { tone?: Tone; action?: ToastItem['action'] }) => void

const ToastContext = createContext<Notify>(() => {})
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])
  const notify = useCallback<Notify>(
    (message, opts) => {
      const id = nextId++
      setItems((all) => [...all.slice(-2), { id, message, tone: opts?.tone ?? 'ok', action: opts?.action }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              className={`${styles.toast} ${t.tone === 'error' ? styles.error : ''}`}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {t.tone === 'error' ? <WarningCircle size={22} weight="fill" /> : <CheckCircle size={22} weight="fill" />}
              <span className={styles.msg}>{t.message}</span>
              {t.action && (
                <button
                  className={styles.action}
                  onClick={() => {
                    t.action?.onClick()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Fechar aviso">
                <X size={16} />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
