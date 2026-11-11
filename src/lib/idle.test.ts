import { describe, expect, it } from 'vitest'
import { YEAR_DAYS, yearUsage } from './idle'

const used = (trips: number, days: number) => yearUsage(trips, days).filter(Boolean).length

describe('ano da mala', () => {
  it('conta só os dias de viagem', () => {
    expect(used(2, 6)).toBe(12)
    expect(used(8, 21)).toBe(168)
    expect(yearUsage(1, 3)).toHaveLength(YEAR_DAYS)
  })

  it('separa as viagens ao longo do ano', () => {
    const on = yearUsage(2, 6)
    const first = on.indexOf(true)
    const second = on.indexOf(true, first + 6)
    expect(second - first).toBeGreaterThan(150)
  })
})
