const REVIEW_PROFESSION_MAP: Record<string, string> = {
  DOCTOR: "PHYSICIAN",
  DENTIST: "DENTIST",
  PHARMACIST: "PHARMACIST",
  NURSE: "NURSE",
  MED_TECH: "MED_TECH",
  RAD_TECH: "RADIOLOGIST",
  PHYSIO: "PHYSICAL_THERAPY",
  OCC_THERAPY: "OCCUPATIONAL_THERAPY",
  CLIN_PSY: "CLINICAL_PSYCHOLOGIST",
  CARDIO_TECH: "CARDIO_THORACIC_TECH",
};

export function normalizeProfessionCodeForReview(code: string): string {
  const normalized = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!normalized) return "";
  return REVIEW_PROFESSION_MAP[normalized] ?? normalized;
}

export function isPeriodLocked(period: any): boolean {
  return Boolean(period?.is_locked);
}
