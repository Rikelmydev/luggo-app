import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { todayISO } from '../lib/dates'
import { kpis, occupancy, rentalsPerModel, revenueByWeek, todayBoard, unitState, weekStart } from './stats'

const now = new Date()
const { units, orders } = buildSeed(now)

describe('painel da equipe', () => {
  it('agrupa a receita por semana começando na segunda', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // domingo -> segunda anterior
    const weeks = revenueByWeek(orders, 10)
    expect(weeks).toHaveLength(10)
    expect(weeks.every((w) => w.value >= 0)).toBe(true)
    expect(weeks.reduce((s, w) => s + w.value, 0)).toBeGreaterThan(0)
  })

  it('mede ocupação entre 0 e 100%', () => {
    const occ = occupancy(units, orders, todayISO(), 30)
    expect(occ).toHaveLength(30)
    expect(occ.every((p) => p.value >= 0 && p.value <= 100)).toBe(true)
  })

  it('conta aluguéis por modelo e mostra o quadro de hoje', () => {
    const per = rentalsPerModel(units, orders)
    expect(per.reduce((n, p) => n + p.units, 0)).toBe(30)
    const board = todayBoard(orders)
    expect(board.outgoing.length).toBeGreaterThanOrEqual(1)
    expect(board.returning.length).toBeGreaterThanOrEqual(1)
    expect(board.cleaning.length).toBeGreaterThanOrEqual(1)
    const k = kpis(units, orders)
    expect(k.active).toBeGreaterThan(0)
  })

  it('mostra a mala em manutenção', () => {
    const broken = units.find((u) => u.maintenance)!
    expect(unitState(broken, orders).state).toBe('manutencao')
  })
})
