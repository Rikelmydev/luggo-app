import { useState, type FormEvent } from 'react'
import { CheckCircle, MapPin, WarningCircle } from './ui/icons'
import { BUSINESS } from '../config/business'
import { maskCep, money } from '../lib/format'
import { inDeliveryArea, lookupCep } from '../services/cep'
import styles from './CepCheck.module.css'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'yes'; place: string }
  | { kind: 'no'; place: string }
  | { kind: 'error'; message: string }

export function CepCheck() {
  const [cep, setCep] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (cep.replace(/\D/g, '').length !== 8) {
      setState({ kind: 'error', message: 'Digite os 8 números do CEP.' })
      return
    }
    setState({ kind: 'loading' })
    const res = await lookupCep(cep)
    if (res.ok) {
      const place = [res.address.district, `${res.address.city}/${res.address.uf}`].filter(Boolean).join(', ')
      setState(inDeliveryArea(res.address) ? { kind: 'yes', place } : { kind: 'no', place })
    } else if (res.reason === 'offline') {
      // Sem internet: decide pela faixa de CEP da capital.
      setState(inDeliveryArea({ cep }) ? { kind: 'yes', place: 'São Paulo/SP' } : { kind: 'no', place: 'seu CEP' })
    } else {
      setState({ kind: 'error', message: res.reason === 'nao_encontrado' ? 'Não encontramos esse CEP. Confira os números.' : 'CEP inválido.' })
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor="cep-check" className={styles.label}>Entregamos no seu CEP?</label>
      <div className={styles.row}>
        <div className={styles.inputWrap}>
          <MapPin size={20} aria-hidden="true" className={styles.icon} />
          <input
            id="cep-check"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => {
              setCep(maskCep(e.target.value))
              if (state.kind !== 'loading') setState({ kind: 'idle' })
            }}
            className={styles.input}
            aria-describedby="cep-check-result"
          />
        </div>
        <button type="submit" className="btn btn--blue" disabled={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Consultando...' : 'Consultar'}
        </button>
      </div>
      <p id="cep-check-result" className={styles.result} role="status">
        {state.kind === 'yes' && (
          <span className={styles.yes}>
            <CheckCircle size={20} weight="fill" aria-hidden="true" /> Entregamos em {state.place}. Entrega e coleta por {money(BUSINESS.pricing.deliveryFee)}.
          </span>
        )}
        {state.kind === 'no' && (
          <span className={styles.no}>
            <WarningCircle size={20} weight="fill" aria-hidden="true" /> Ainda não entregamos em {state.place}. Você pode retirar a mala na nossa loja, sem custo.
          </span>
        )}
        {state.kind === 'error' && <span className={styles.no}>{state.message}</span>}
      </p>
    </form>
  )
}
