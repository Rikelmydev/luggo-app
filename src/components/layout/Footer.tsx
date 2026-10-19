import { Link } from 'react-router'
import { BUSINESS } from '../../config/business'
import { Lockup } from './Brand'
import styles from './Footer.module.css'

export function Footer() {
  const { store } = BUSINESS
  return (
    <footer data-chrome className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.brandCol}>
          <Lockup />
          <p className={styles.pitch}>Malas de qualidade por período, para quem viaja pouco e não tem onde guardar uma.</p>
        </div>
        <nav aria-label="Aluguel" className={styles.col}>
          <p className={styles.head}>Aluguel</p>
          <Link to="/malas">Todas as malas</Link>
          <Link to="/malas?tamanho=kit">Kits</Link>
          <Link to="/como-funciona">Como funciona</Link>
          <Link to="/perguntas">Perguntas frequentes</Link>
          <Link to="/minhas-reservas">Minhas reservas</Link>
        </nav>
        <nav aria-label="Luggo" className={styles.col}>
          <p className={styles.head}>Luggo</p>
          <Link to="/sobre">Sobre nós</Link>
          <Link to="/contato">Contato</Link>
          <Link to="/termos">Termos de aluguel</Link>
          <Link to="/equipe">Área da equipe</Link>
        </nav>
        <div className={styles.col}>
          <p className={styles.head}>Loja</p>
          <p>{store.address}</p>
          <p className={styles.muted}>{store.landmark}</p>
          <dl className={styles.hours}>
            {store.hours.map((h) => (
              <div key={h.days}>
                <dt>{h.days}</dt>
                <dd>{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <p>© 2026 Luggo. Projeto demonstrativo: a Luggo é uma startup fictícia, os dados são de exemplo e nenhum pagamento é cobrado.</p>
      </div>
    </footer>
  )
}
