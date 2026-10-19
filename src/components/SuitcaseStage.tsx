import { useEffect } from 'react'
import { useAnimationControls, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { AirplaneTilt } from './ui/icons'
import caseImg from '../assets/img/suitcase-case.webp'
import handleImg from '../assets/img/suitcase-handle.webp'
import shadowImg from '../assets/img/suitcase-shadow.webp'
import styles from './SuitcaseStage.module.css'

/** A mala do deck: chega rolando, a alça sobe e a etiqueta balança. */
export function SuitcaseStage() {
  const reduce = useReducedMotion()
  const tag = useAnimationControls()

  const swing = (dir: number) =>
    tag.start({ rotate: [8 + dir * 22, 8], transition: { type: 'spring', stiffness: 60, damping: 4, mass: 0.6 } })

  // A etiqueta aparece depois que a alça sobe e balança até parar.
  useEffect(() => {
    if (reduce) return
    tag.set({ scale: 0, rotate: 50 })
    const t = setTimeout(() => {
      tag.start({
        scale: 1,
        rotate: 8,
        transition: { scale: { type: 'spring', stiffness: 420, damping: 18 }, rotate: { type: 'spring', stiffness: 40, damping: 3.2 } },
      })
    }, 1550)
    return () => clearTimeout(t)
  }, [reduce, tag])

  if (reduce) {
    return (
      <div className={styles.stage}>
        <div className={styles.suitcase}>
          <img className={styles.layer} src={shadowImg} alt="" width={1000} height={1312} />
          <img className={styles.layer} src={handleImg} alt="" width={1000} height={1312} />
          <img className={styles.layer} src={caseImg} alt="Mala de viagem laranja da Luggo" width={1000} height={1312} />
          <Tag />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.stage}>
      <m.div
        className={styles.suitcase}
        initial={{ x: '120vw', rotate: -3 }}
        animate={{ x: 0, rotate: 0 }}
        transition={{ x: { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }, rotate: { type: 'spring', stiffness: 120, damping: 8, delay: 1 } }}
      >
        <img className={styles.layer} src={shadowImg} alt="" width={1000} height={1312} />
        <m.img
          className={styles.layer}
          src={handleImg}
          alt=""
          width={1000}
          height={1312}
          initial={{ y: '25%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 12, delay: 1.2 }}
        />
        <img className={styles.layer} src={caseImg} alt="Mala de viagem laranja da Luggo" width={1000} height={1312} fetchPriority="high" />
        <m.div
          className={styles.tagWrap}
          initial={{ scale: 0, rotate: 50 }}
          animate={tag}
          onPointerEnter={(e) => swing(e.movementX >= 0 ? 1 : -1)}
        >
          <Tag />
        </m.div>
      </m.div>
    </div>
  )
}

function Tag() {
  return (
    <div className={styles.tag}>
      <svg className={styles.string} viewBox="0 0 40 70" aria-hidden="true">
        <path d="M20 2 C 8 22, 32 40, 20 68" />
      </svg>
      <div className={styles.card}>
        <span className={styles.hole} aria-hidden="true" />
        <AirplaneTilt weight="fill" className={styles.plane} aria-hidden="true" />
        <span className={styles.name}>Luggo,</span>
        <span className={styles.line}>Sua mala a<br />pronta entrega</span>
      </div>
    </div>
  )
}
