import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, CreditCard, Info, PixLogo, SpinnerGap } from './ui/icons'
import type { Order } from '../domain/types'
import { money } from '../lib/format'
import { settlePayment, switchPayment } from '../services/orders'
import { PAYMENT_DEMO, PAYMENT_PROVIDER } from '../services/payments'
import { useNow } from '../state/hooks'
import { Modal } from './ui/Modal'
import { Notice } from './ui/Bits'
import styles from './PaymentModal.module.css'

interface Props {
  order: Order
  open: boolean
  onClose: () => void
  onPaid: (order: Order) => void
}

type CardStep = 'intro' | 'redirecting' | 'demo'

export function PaymentModal({ order: initial, open, onClose, onPaid }: Props) {
  const [order, setOrder] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [cardStep, setCardStep] = useState<CardStep>('intro')
  const now = useNow()

  useEffect(() => {
    setOrder(initial)
    setError(null)
    setCardStep('intro')
  }, [initial, open])

  const expires = order.payment.expiresAt ? new Date(order.payment.expiresAt).getTime() : 0
  const left = Math.max(0, expires - now)
  const expired = left === 0
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  async function pay(approved: boolean) {
    setBusy(true)
    setError(null)
    const res = await settlePayment(order.code, approved)
    setBusy(false)
    if (res.ok) onPaid(res.value)
    else {
      setError(res.error)
      setCardStep('intro')
    }
  }

  async function switchTo(method: 'pix' | 'cartao') {
    setBusy(true)
    setError(null)
    setOrder(await switchPayment(order.code, method))
    setCardStep('intro')
    setBusy(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(order.payment.pixCode ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  function goToProvider() {
    setCardStep('redirecting')
    setTimeout(() => setCardStep('demo'), 1300)
  }

  const isPix = order.payment.method === 'pix'

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy || cardStep === 'redirecting'}
      title={isPix ? 'Pague com Pix' : 'Pague com cartão'}
      description={`Reserva ${order.code}, total de ${money(order.price.total)}`}
    >
      <div className={styles.wrap}>
        {PAYMENT_DEMO && (
          <p className={styles.demo}>
            <Info size={18} weight="bold" aria-hidden="true" />
            Modo demonstração: nenhum valor é cobrado e o código abaixo não pode ser pago.
          </p>
        )}

        {expired ? (
          <Notice tone="bad">O prazo para pagar acabou e as malas foram liberadas. Faça a reserva de novo para separar outras.</Notice>
        ) : isPix ? (
          <div className={styles.pix}>
            <div className={styles.qr}>
              <QRCodeSVG value={order.payment.pixCode ?? order.code} size={196} level="M" marginSize={2} title={`QR Code Pix da reserva ${order.code}`} />
            </div>
            <ol className={styles.howto}>
              <li>Abra o app do seu banco e escolha pagar com Pix.</li>
              <li>Aponte a câmera para o QR Code ou cole o código.</li>
              <li>Confirme o valor de <strong>{money(order.price.total)}</strong>.</li>
            </ol>
            <div className={styles.copyRow}>
              <input readOnly value={order.payment.pixCode ?? ''} aria-label="Código Pix copia e cola" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
                <Copy size={18} aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className={styles.timer} aria-live="off">
              As malas ficam separadas por <strong className="num">{mm}:{ss}</strong>
            </p>
          </div>
        ) : (
          <div className={styles.card}>
            {cardStep === 'intro' && (
              <>
                <CreditCard size={40} className={styles.cardIcon} aria-hidden="true" />
                <p>
                  Você vai digitar os dados do cartão no ambiente seguro do {PAYMENT_PROVIDER}. A Luggo não recebe nem guarda o número do seu cartão.
                </p>
              </>
            )}
            {cardStep === 'redirecting' && (
              <p className={styles.redirect} role="status">
                <SpinnerGap size={28} className={styles.spin} aria-hidden="true" /> Abrindo o {PAYMENT_PROVIDER}...
              </p>
            )}
            {cardStep === 'demo' && (
              <p className={styles.demoChoice}>
                Na versão real, você estaria na página do {PAYMENT_PROVIDER} agora. Escolha como o pagamento termina:
              </p>
            )}
          </div>
        )}

        {error && <Notice tone="bad">{error}</Notice>}

        {!expired && (
          <div className={styles.actions}>
            {isPix ? (
              <>
                <button type="button" className="btn btn--blue btn--block" disabled={busy} onClick={() => pay(true)}>
                  {busy ? 'Confirmando pagamento...' : 'Simular pagamento recebido'}
                </button>
                <button type="button" className={styles.switch} disabled={busy} onClick={() => switchTo('cartao')}>
                  <CreditCard size={18} aria-hidden="true" /> Prefiro pagar com cartão
                </button>
              </>
            ) : cardStep === 'demo' ? (
              <>
                <button type="button" className="btn btn--blue btn--block" disabled={busy} onClick={() => pay(true)}>
                  {busy ? 'Confirmando pagamento...' : 'Simular pagamento aprovado'}
                </button>
                <button type="button" className="btn btn--danger btn--block" disabled={busy} onClick={() => pay(false)}>
                  Simular cartão recusado
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--blue btn--block" disabled={busy || cardStep === 'redirecting'} onClick={goToProvider}>
                  Continuar no {PAYMENT_PROVIDER}
                </button>
                <button type="button" className={styles.switch} disabled={busy || cardStep === 'redirecting'} onClick={() => switchTo('pix')}>
                  <PixLogo size={18} aria-hidden="true" /> Prefiro pagar com Pix
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
