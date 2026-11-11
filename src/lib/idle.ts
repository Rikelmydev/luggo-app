// O ano de uma mala comprada: em quais dias ela viaja e em quais fica no armário.
export const YEAR_DAYS = 365

/** Viagens espalhadas por igual no ano, cada uma no meio do seu trecho. */
export function yearUsage(trips: number, daysPerTrip: number): boolean[] {
  const on = new Array<boolean>(YEAR_DAYS).fill(false)
  const spacing = YEAR_DAYS / trips
  for (let t = 0; t < trips; t++) {
    const start = Math.max(0, Math.min(YEAR_DAYS - daysPerTrip, Math.round(spacing * t + spacing / 2 - daysPerTrip / 2)))
    for (let d = start; d < start + daysPerTrip; d++) on[d] = true
  }
  return on
}
