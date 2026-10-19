import { useId, useState } from 'react'
import { CaretDown } from './icons'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import styles from './Accordion.module.css'

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const base = useId()
  const reduce = useReducedMotion()
  return (
    <div className={styles.list}>
      {items.map((item, i) => {
        const isOpen = open === i
        const panelId = `${base}-p${i}`
        return (
          <div key={item.q} className={styles.item}>
            <h3 className={styles.h}>
              <button
                type="button"
                className={styles.q}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <CaretDown size={20} weight="bold" className={styles.caret} aria-hidden="true" />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div
                  id={panelId}
                  role="region"
                  className={styles.panel}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className={styles.a}>{item.a}</p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
