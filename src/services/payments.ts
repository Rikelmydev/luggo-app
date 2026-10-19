// Pagamentos pelo Mercado Pago.
//
// Nesta versão (só front-end) o pagamento é SIMULADO: nenhum valor é cobrado e o
// código Pix gerado não pode ser pago. O site nunca pede número de cartão.
//
// Para cobrar de verdade:
// 1. Crie uma função serverless (ex.: Vercel Functions) com o Access Token do
//    Mercado Pago guardado como variável de ambiente (nunca no navegador).
// 2. Pix: a função chama POST /v1/payments com payment_method_id = "pix" e devolve
//    point_of_interaction.transaction_data (qr_code e qr_code_base64).
// 3. Cartão: a função cria uma preferência (POST /checkout/preferences) e devolve
//    o init_point; o site redireciona o cliente para o Checkout Pro.
// 4. Um webhook do Mercado Pago avisa a função quando o pagamento for aprovado,
//    e ela muda o pedido para "confirmado".
// Só as funções abaixo precisam mudar; as telas continuam iguais.
import { BUSINESS } from '../config/business'

export const PAYMENT_PROVIDER = 'Mercado Pago'
export const PAYMENT_DEMO = BUSINESS.demo

export interface PixCharge {
  code: string
  expiresAt: string
}

export function createPixCharge(reference: string, amount: number, now = new Date()): PixCharge {
  const expires = new Date(now.getTime() + BUSINESS.operations.pixMinutes * 60_000)
  const value = amount.toFixed(2)
  // Formato propositalmente inválido para Pix: ninguém consegue pagar este código.
  const code = `LUGGO-DEMO-PIX|PEDIDO:${reference}|VALOR:${value}|SEM-COBRANCA-REAL`
  return { code, expiresAt: expires.toISOString() }
}
