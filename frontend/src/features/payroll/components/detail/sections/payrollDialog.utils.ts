export function isValidCalculation(daysInMonth: number, eligible: number, deducted: number) {
  return (
    daysInMonth > 0 &&
    Number.isFinite(eligible) &&
    eligible >= 0 &&
    Number.isFinite(deducted) &&
    deducted >= 0 &&
    eligible + deducted <= daysInMonth
  )
}
