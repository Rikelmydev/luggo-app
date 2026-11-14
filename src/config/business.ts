// Tudo o que a equipe precisa ajustar fica aqui. Valores fictícios de demonstração.

export const BUSINESS = {
  brand: 'Luggo',
  tagline: 'Sua mala a pronta entrega',

  store: {
    name: 'Loja Luggo Vila Mariana',
    address: 'Rua Domingos de Morais, Vila Mariana, São Paulo',
    landmark: 'No caminho da sua casa e da sua viagem',
    hours: [
      { days: 'Segunda a sexta', time: '8h às 20h' },
      { days: 'Sábado', time: '9h às 15h' },
      { days: 'Domingo e feriados', time: 'Fechado' },
    ],
  },

  pricing: {
    minDays: 1,
    /**
     * Preço de UMA mala pelo período inteiro, por peso que ela leva (tabela de 2026):
     * de bordo até 10 kg, média até 23 kg, grande até 32 kg. Entre os dias marcados, o preço
     * sobe em linha reta; quanto mais dias, menor o preço por dia.
     */
    table: {
      P: [[1, 24.9], [7, 69.9], [15, 99.9], [30, 129.9]],
      M: [[1, 34.9], [7, 89.9], [15, 139.9], [30, 179.9]],
      G: [[1, 39.9], [7, 109.9], [15, 169.9], [30, 219.9]],
    },
    /** Proteção contra danos: por mala, por dia. */
    protectionPerDay: 3,
    /** Entrega e coleta na capital, por pedido. */
    deliveryFee: 24.9,
    /** Atraso sem aviso: o preço de 1 dia x este fator, por dia. */
    extraDayFactor: 1.2,
  },

  operations: {
    /** Dias que a mala passa em higienização depois de voltar. */
    cleaningDays: 1,
    /** Antecedência mínima para entrega em casa (0 = no mesmo dia). */
    deliveryLeadDays: 0,
    /** Até quantas horas antes da retirada o cancelamento é grátis. */
    freeCancelHours: 48,
    /** Quanto tempo o Pix fica válido. */
    pixMinutes: 30,
    /** Até quantos dias à frente dá para reservar. */
    maxAdvanceDays: 180,
    /** A tabela de preços vai até 30 dias. */
    maxDays: 30,
    deliveryWindows: [
      { id: 'manha', label: 'Manhã', time: '8h às 12h', endHour: 12 },
      { id: 'tarde', label: 'Tarde', time: '12h às 16h', endHour: 16 },
      { id: 'noite', label: 'Noite', time: '16h às 20h', endHour: 20 },
    ],
    /** Hora em que a loja fecha, limite para devolver no último dia. */
    storeCloseHour: { weekday: 20, saturday: 15 },
    /** Quantas horas antes do fim do aluguel sai o e-mail de lembrete. */
    returnReminderHours: 24,
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
