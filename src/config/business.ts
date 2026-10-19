// Tudo o que a equipe precisa ajustar fica aqui. Valores fictícios de demonstração.

export const BUSINESS = {
  brand: 'Luggo',
  tagline: 'Sua mala a pronta entrega',

  store: {
    name: 'Loja Luggo Vila Mariana',
    address: 'Rua Domingos de Morais, Vila Mariana, São Paulo',
    landmark: 'A 2 minutos do metrô Ana Rosa (linhas 1-Azul e 2-Verde)',
    hours: [
      { days: 'Segunda a sexta', time: '8h às 20h' },
      { days: 'Sábado', time: '9h às 15h' },
      { days: 'Domingo e feriados', time: 'Fechado' },
    ],
  },

  pricing: {
    minDays: 3,
    /** Desconto progressivo pelo número de diárias (o maior que couber vale). */
    discounts: [
      { fromDays: 14, pct: 0.2 },
      { fromDays: 7, pct: 0.1 },
    ],
    /** Proteção contra danos: por mala, por dia. */
    protectionPerDay: 3,
    /** Entrega e coleta na capital, por pedido. */
    deliveryFee: 24.9,
    /** Dia extra (atraso ou extensão) = diária cheia x este fator. */
    extraDayFactor: 1.2,
  },

  operations: {
    /** Dias que a mala passa em higienização depois de voltar. */
    cleaningDays: 1,
    /** Antecedência mínima para entrega em casa. */
    deliveryLeadDays: 1,
    /** Até quantas horas antes da retirada o cancelamento é grátis. */
    freeCancelHours: 48,
    /** Quanto tempo o Pix fica válido. */
    pixMinutes: 30,
    /** Até quantos dias à frente dá para reservar. */
    maxAdvanceDays: 180,
    maxDays: 60,
    deliveryWindows: [
      { id: 'manha', label: 'Manhã', time: '8h às 12h' },
      { id: 'tarde', label: 'Tarde', time: '12h às 16h' },
      { id: 'noite', label: 'Noite', time: '16h às 20h' },
    ],
  },

  /** Entrega só na capital. Faixas de CEP usadas quando o ViaCEP não responde. */
  deliveryArea: {
    city: 'São Paulo',
    uf: 'SP',
    cepRanges: [
      ['01000000', '05999999'],
      ['08000000', '08499999'],
    ] as [string, string][],
  },

  /** PIN do painel da equipe (demonstração). */
  adminPin: '2026',

  /** Projeto demonstrativo: nenhum valor é cobrado. */
  demo: true,
} as const

export type DeliveryWindowId = (typeof BUSINESS.operations.deliveryWindows)[number]['id']
