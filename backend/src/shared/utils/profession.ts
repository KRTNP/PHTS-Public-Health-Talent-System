const startsWithAny = (value: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => value.startsWith(prefix));

const includesAny = (value: string, terms: string[]): boolean =>
  terms.some((term) => value.includes(term));

const NURSE_EXCLUDED_PREFIXES = [
  "ผู้ช่วยพยาบาล",
  "พนักงานช่วยการพยาบาล",
  "พนักงานช่วยเหลือคนไข้",
];

const PREFIX_RULES: Array<{ prefixes: string[]; code: string }> = [
  { prefixes: ["นักเทคนิคการแพทย์"], code: "MED_TECH" },
  { prefixes: ["นักรังสีการแพทย์"], code: "RAD_TECH" },
  { prefixes: ["นักกายภาพบำบัด", "นักกายภาพบําบัด"], code: "PHYSIO" },
  { prefixes: ["นักกิจกรรมบำบัด", "นักกิจกรรมบําบัด"], code: "OCC_THERAPY" },
  { prefixes: ["นักอาชีวบำบัด", "นักอาชีวบําบัด"], code: "OCC_THERAPY" },
  { prefixes: ["นักจิตวิทยา"], code: "CLIN_PSY" },
  { prefixes: ["นักแก้ไขความผิดปกติ"], code: "SPEECH_THERAPIST" },
  { prefixes: ["นักวิชาการศึกษาพิเศษ"], code: "SPECIAL_EDU" },
  { prefixes: ["นักเทคโนโลยีหัวใจและทรวงอก"], code: "CARDIO_TECH" },
];

export const resolveProfessionCode = (positionName: string): string | null => {
  const name = positionName.trim();

  if (name.includes("ทันตแพทย์")) return "DENTIST";
  for (const rule of PREFIX_RULES) {
    if (startsWithAny(name, rule.prefixes)) {
      return rule.code;
    }
  }
  if (name.includes("เภสัชกร")) return "PHARMACIST";
  if (includesAny(name, ["พยาบาล"])) {
    if (startsWithAny(name, NURSE_EXCLUDED_PREFIXES)) return null;
    return "NURSE";
  }
  if (name.includes("นายแพทย์")) return "DOCTOR";
  if (name.includes("แพทย์") && !name.includes("การแพทย์")) return "DOCTOR";
  return null;
};
