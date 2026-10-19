import { BUSINESS } from '../config/business'
import { moneyShort } from '../lib/format'

const { pricing, operations } = BUSINESS

export interface FaqItem { q: string; a: string }
export interface FaqGroup { title: string; items: FaqItem[] }

export const FAQ: FaqGroup[] = [
  {
    title: 'Reserva',
    items: [
      { q: 'Qual é o período mínimo de aluguel?', a: `${pricing.minDays} diárias. Contamos as diárias entre o dia da retirada e o dia da devolução: de sábado a sábado são 7 diárias.` },
      { q: 'Tem desconto para viagens longas?', a: 'Sim. A partir de 7 diárias o aluguel sai 10% mais barato, e a partir de 14 diárias, 20%. O desconto aparece sozinho no resumo.' },
      { q: 'Posso reservar mais de uma mala?', a: 'Pode. Junte quantas malas quiser na mesma reserva, de tamanhos e cores diferentes. Para a família toda, os kits saem mais em conta.' },
      { q: 'Com quanta antecedência preciso reservar?', a: `Para retirar na loja, até no mesmo dia, se houver mala livre. Para entrega em casa, a partir do dia seguinte. As reservas abrem com até ${operations.maxAdvanceDays} dias de antecedência.` },
    ],
  },
  {
    title: 'Entrega e retirada',
    items: [
      { q: 'Onde vocês entregam?', a: `Em toda a capital de São Paulo. A entrega e a coleta custam ${moneyShort(pricing.deliveryFee)} por pedido, juntas. Fora da capital, a retirada é na loja.` },
      { q: 'Como funciona a entrega?', a: 'Você escolhe uma janela de horário (manhã, tarde ou noite) para receber e combinamos a coleta no último dia, na mesma janela. Alguém precisa estar no endereço.' },
      { q: 'Onde fica a loja?', a: `${BUSINESS.store.address}. ${BUSINESS.store.landmark}.` },
      { q: 'E se eu voltar antes?', a: 'Pode devolver antes, sem problema. O valor das diárias não usadas não é devolvido.' },
    ],
  },
  {
    title: 'Pagamento',
    items: [
      { q: 'Quais as formas de pagamento?', a: 'Pix ou cartão de crédito, pelo Mercado Pago. O cartão é digitado no próprio Mercado Pago: a Luggo nunca vê os dados dele.' },
      { q: 'Quando a reserva é confirmada?', a: `Assim que o pagamento é aprovado. O Pix vale por ${operations.pixMinutes} minutos; nesse tempo, as malas ficam separadas para você.` },
      { q: 'Posso cancelar?', a: `Sim, sem custo até ${operations.freeCancelHours} horas antes da retirada, pela página da reserva. O valor volta pela mesma forma de pagamento.` },
      { q: 'Dá para ficar mais dias com a mala?', a: 'Dá, se as mesmas malas estiverem livres depois. Peça pela página da reserva antes do fim do aluguel: os dias extras saem pela diária cheia. Atraso sem aviso custa a diária com 20% a mais.' },
    ],
  },
  {
    title: 'Cuidados e danos',
    items: [
      { q: 'As malas são higienizadas?', a: 'Toda mala passa por limpeza interna e externa, higienização das alças e revisão de rodas e zíperes antes de cada aluguel. Por isso ela fica um dia fora do estoque depois de voltar.' },
      { q: 'E se a mala quebrar na viagem?', a: `Com a Proteção Luggo (${moneyShort(pricing.protectionPerDay)} por mala por dia), danos de uso como rodas, alças e zíperes ficam por nossa conta. Sem a proteção, cobramos o reparo conforme a tabela dos termos de aluguel.` },
      { q: 'E se a companhia aérea extraviar a mala?', a: 'Registre a ocorrência no balcão da companhia (o RIB) e nos avise. A indenização da companhia é usada para repor a mala; se ela não cobrir o valor, a diferença segue os termos de aluguel.' },
      { q: 'A mala vem com cadeado?', a: 'Todas têm cadeado TSA integrado, aceito na fiscalização de bagagem dos Estados Unidos. A combinação vem no resumo da reserva.' },
    ],
  },
]

export const FAQ_HIGHLIGHTS: FaqItem[] = [FAQ[0].items[0], FAQ[1].items[0], FAQ[2].items[2], FAQ[3].items[0], FAQ[3].items[1]]
