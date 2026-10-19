import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from './icons'
import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Impede fechar clicando fora (ex.: durante um pagamento). */
  locked?: boolean
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', locked }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[size]}`}
      aria-labelledby={open ? titleId : undefined}
      aria-describedby={open && description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (!locked) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose()
      }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.head}>
            <div>
              <h2 id={titleId} className={styles.title}>{title}</h2>
              {description && <p id={descId} className={styles.desc}>{description}</p>}
            </div>
            {!locked && (
              <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
                <X size={20} />
              </button>
            )}
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.foot}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
