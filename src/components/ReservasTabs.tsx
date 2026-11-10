import { NavLink } from 'react-router'
import { isActive } from '../services/orders'
import { useBag } from '../state/bag'
import { useDB } from '../state/hooks'
import styles from './ReservasTabs.module.css'

/** Liga a reserva em montagem às reservas já feitas, que dividem o botão Reservas. */
export function ReservasTabs() {
  const { count } = useBag()
  const { orders } = useDB()
  const made = orders.filter((o) => o.source === 'site' && isActive(o)).length
  return (
    <div className="container">
      <nav className={styles.tabs} aria-label="Reservas">
        <NavLink to="/reserva" className={styles.tab}>Para finalizar <span className={styles.n}>{count}</span></NavLink>
        <NavLink to="/minhas-reservas" className={styles.tab}>Feitas <span className={styles.n}>{made}</span></NavLink>
      </nav>
    </div>
  )
}
