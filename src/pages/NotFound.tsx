import { Link } from 'react-router'
import { usePageTitle } from '../state/hooks'
import styles from './NotFound.module.css'

export function NotFound() {
  usePageTitle('Página não encontrada')
  return (
    <section className={`container ${styles.wrap}`}>
      <p className={styles.code} aria-hidden="true">404</p>
      <h1 className="display h2">Essa página pegou outro voo</h1>
      <p className="lede">O endereço pode ter mudado ou estar digitado errado.</p>
      <div className={styles.actions}>
        <Link to="/" className="btn btn--blue">Ir para o início</Link>
        <Link to="/malas" className="link">Ver as malas</Link>
      </div>
    </section>
  )
}
