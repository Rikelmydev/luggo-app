import laranja from '../assets/products/mala-laranja.webp'
import azul from '../assets/products/mala-azul.webp'
import grafite from '../assets/products/mala-grafite.webp'
import kitCasal from '../assets/products/kit-casal.webp'
import kitFamilia from '../assets/products/kit-familia.webp'

export type Size = 'P' | 'M' | 'G'
export type Color = 'laranja' | 'azul' | 'grafite'
export type Kind = 'rigida' | 'expansivel' | 'kit'

export interface Dimensions { h: number; w: number; d: number; expandsTo?: number }

export interface Model {
  id: string
  name: string
  kind: Kind
  /** Tamanho principal (para filtro). Kits usam o maior tamanho que contêm. */
  size: Size
  daily: number
  colors: Color[]
  summary: string
  description: string
  highlights: string[]
  dims?: Dimensions
  weightKg?: number
  capacityL?: number
  capacityExpandedL?: number
  /** Quanto o viajante pode levar dentro, pela regra das companhias aéreas. */
  allowance?: string
  /** Para kits: quais malas avulsas compõem o kit. */
  contains?: { modelId: string; qty: number }[]
  idealFor: string
}

export const SIZE_INFO: Record<Size, { label: string; short: string; allowance: string }> = {
  P: { label: 'De bordo', short: 'P', allowance: 'Bagagem de mão, até 10 kg' },
  M: { label: 'Média', short: 'M', allowance: 'Despachada, até 23 kg' },
  G: { label: 'Grande', short: 'G', allowance: 'Despachada, até 32 kg' },
}

export const COLOR_INFO: Record<Color, { label: string; swatch: string; image: string }> = {
  laranja: { label: 'Laranja', swatch: '#ffa51f', image: laranja },
  azul: { label: 'Azul Luggo', swatch: '#2445ff', image: azul },
  grafite: { label: 'Grafite', swatch: '#4a4f5c', image: grafite },
}

export const KIT_IMAGES: Record<string, string> = {
  'kit-casal': kitCasal,
  'kit-familia': kitFamilia,
}

export const MODELS: Model[] = [
  {
    id: 'bordo-rigida',
    name: 'Bordo Rígida',
    kind: 'rigida',
    size: 'P',
    daily: 14,
    colors: ['laranja', 'azul', 'grafite'],
    summary: 'Cabe no bagageiro do avião. Para viagens curtas e a trabalho.',
    description:
      'Casco de policarbonato que aguenta o vai e vem de aeroporto, rodas 360° silenciosas e alça telescópica de alumínio com três alturas. Por dentro, divisória com zíper e cintas de compressão.',
    highlights: ['Cadeado TSA integrado', 'Rodas duplas 360°', 'Divisória com zíper', 'Higienizada a cada aluguel'],
    dims: { h: 55, w: 35, d: 22 },
    weightKg: 2.6,
    capacityL: 38,
    allowance: SIZE_INFO.P.allowance,
    idealFor: '1 a 4 dias, voo nacional sem despachar',
  },
  {
    id: 'bordo-expansivel',
    name: 'Bordo Expansível',
    kind: 'expansivel',
    size: 'P',
    daily: 16,
    colors: ['grafite', 'azul'],
    summary: 'De bordo com zíper de expansão, para a volta com sacolas.',
    description:
      'Mesmo tamanho de bagagem de mão, mas com um zíper que abre 5 cm a mais para quando a mala volta mais cheia do que foi. Bolso frontal acolchoado para notebook de até 15".',
    highlights: ['Expande 5 cm', 'Bolso frontal para notebook', 'Cadeado TSA integrado', 'Rodas duplas 360°'],
    dims: { h: 55, w: 36, d: 23, expandsTo: 28 },
    weightKg: 2.9,
    capacityL: 42,
    capacityExpandedL: 50,
    allowance: SIZE_INFO.P.allowance,
    idealFor: 'Viagem a trabalho e bate e volta com compras',
  },
  {
    id: 'media-rigida',
    name: 'Média Rígida',
    kind: 'rigida',
    size: 'M',
    daily: 18,
    colors: ['laranja', 'azul', 'grafite'],
    summary: 'A mais alugada. Uma semana de viagem com folga.',
    description:
      'O tamanho que resolve a maioria das viagens de 5 a 10 dias. Casco rígido, rodas 360°, cadeado TSA e dois compartimentos com cintas cruzadas para a roupa chegar dobrada.',
    highlights: ['Cadeado TSA integrado', 'Dois compartimentos', 'Cintas de compressão', 'Higienizada a cada aluguel'],
    dims: { h: 65, w: 44, d: 27 },
    weightKg: 3.4,
    capacityL: 68,
    allowance: SIZE_INFO.M.allowance,
    idealFor: '5 a 10 dias, uma pessoa',
  },
  {
    id: 'media-expansivel',
    name: 'Média Expansível',
    kind: 'expansivel',
    size: 'M',
    daily: 20,
    colors: ['azul', 'grafite'],
    summary: 'Média com espaço extra para presentes e compras.',
    description:
      'Expande 6 cm com um zíper e ganha 12 litros. Bom para quem vai fazer compras na viagem ou leva roupa de frio, que ocupa mais espaço.',
    highlights: ['Expande 6 cm', 'Ganha 12 litros', 'Cadeado TSA integrado', 'Rodas duplas 360°'],
    dims: { h: 66, w: 45, d: 28, expandsTo: 34 },
    weightKg: 3.7,
    capacityL: 72,
    capacityExpandedL: 84,
    allowance: SIZE_INFO.M.allowance,
    idealFor: 'Viagem com compras ou roupa de frio',
  },
  {
    id: 'grande-rigida',
    name: 'Grande Rígida',
    kind: 'rigida',
    size: 'G',
    daily: 22,
    colors: ['laranja', 'azul', 'grafite'],
    summary: 'Para viagens longas, intercâmbio ou duas pessoas.',
    description:
      'Cabe a bagagem de duas semanas ou de duas pessoas numa viagem curta. Alça lateral e inferior para levantar sem esforço na esteira.',
    highlights: ['Cadeado TSA integrado', 'Alças lateral e inferior', 'Cintas de compressão', 'Higienizada a cada aluguel'],
    dims: { h: 76, w: 51, d: 31 },
    weightKg: 4.3,
    capacityL: 105,
    allowance: SIZE_INFO.G.allowance,
    idealFor: '10 dias ou mais, ou duas pessoas',
  },
  {
    id: 'grande-expansivel',
    name: 'Grande Expansível',
    kind: 'expansivel',
    size: 'G',
    daily: 25,
    colors: ['grafite', 'azul'],
    summary: 'A maior da casa. Intercâmbio, mudança e viagem longa.',
    description:
      'A mala para quando tudo precisa ir: intercâmbio, temporada fora ou uma mudança. Expande 6 cm e chega a 128 litros.',
    highlights: ['Expande 6 cm', 'Até 128 litros', 'Alças lateral e inferior', 'Rodas reforçadas'],
    dims: { h: 77, w: 52, d: 32, expandsTo: 38 },
    weightKg: 4.7,
    capacityL: 112,
    capacityExpandedL: 128,
    allowance: SIZE_INFO.G.allowance,
    idealFor: 'Intercâmbio e mudanças',
  },
  {
    id: 'kit-casal',
    name: 'Kit Casal',
    kind: 'kit',
    size: 'M',
    daily: 32,
    colors: [],
    summary: 'Duas médias rígidas por um preço menor que avulsas.',
    description:
      'Duas Médias Rígidas para duas pessoas numa viagem de até 10 dias. As cores são sortidas de acordo com o estoque do dia.',
    highlights: ['2 Médias Rígidas', 'Economia de R$ 4 por dia', 'Cores sortidas', 'Uma única devolução'],
    contains: [{ modelId: 'media-rigida', qty: 2 }],
    idealFor: 'Casal, 5 a 10 dias',
  },
  {
    id: 'kit-familia',
    name: 'Kit Família',
    kind: 'kit',
    size: 'G',
    daily: 62,
    colors: [],
    summary: 'Duas grandes e duas de bordo para a família toda.',
    description:
      'Duas Grandes Rígidas para despachar e duas Bordo Rígidas para a cabine. Um único pedido, uma única devolução.',
    highlights: ['2 Grandes + 2 de Bordo', 'Economia de R$ 10 por dia', 'Cores sortidas', 'Uma única devolução'],
    contains: [
      { modelId: 'grande-rigida', qty: 2 },
      { modelId: 'bordo-rigida', qty: 2 },
    ],
    idealFor: 'Família de 3 a 4 pessoas',
  },
]

export const getModel = (id: string) => MODELS.find((m) => m.id === id)

export function modelImage(model: Model, color?: Color): string {
  if (model.kind === 'kit') return KIT_IMAGES[model.id]
  return COLOR_INFO[color ?? model.colors[0]].image
}

/** Quantas malas físicas um item ocupa (kits contam cada mala). */
export function unitsPerItem(model: Model): number {
  return model.contains ? model.contains.reduce((n, c) => n + c.qty, 0) : 1
}

/** Valor das malas avulsas que formam o kit, por dia. */
export function kitListDaily(model: Model): number {
  return (model.contains ?? []).reduce((sum, c) => sum + (getModel(c.modelId)?.daily ?? 0) * c.qty, 0)
}
