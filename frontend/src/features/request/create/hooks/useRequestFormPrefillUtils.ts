import { parseAssignmentOrderSummary } from "@/features/request/shared/ocr/assignmentOrder";
import type { PrefillProfile } from "@/features/request/core/api";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";

const THAI_MONTH_TO_INDEX: Record<string, number> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};

const toArabicDigits = (value: string): string => {
  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
  return value.replace(/[๐-๙]/g, (char) => String(thaiDigits.indexOf(char)));
};

export const parseThaiDateToYmd = (value: string): string | null => {
  const normalized = toArabicDigits(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const match = normalized.match(
    /([0-9]{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:พ\.ศ\.\s*)?([0-9]{4})/,
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const day = Number(match[1]);
  const month = THAI_MONTH_TO_INDEX[match[2]] ?? 0;
  const buddhistYear = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(buddhistYear)) {
    return null;
  }

  const year = buddhistYear > 2400 ? buddhistYear - 543 : buddhistYear;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2600) {
    return null;
  }

  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const extractEffectiveDateFromOcrPrecheck = (
  ocrPrecheck: RequestWithDetails["ocr_precheck"],
  personName: string,
): string | null => {
  const results = ocrPrecheck?.results ?? [];
  for (const result of results) {
    const fields = (result?.fields ?? {}) as Record<string, unknown>;
    const directValue =
      String(
        fields.effective_date ??
          fields.order_effective_date ??
          fields.start_date ??
          fields.effectiveDate ??
          fields.orderEffectiveDate ??
          "",
      ).trim();
    const parsedDirect = directValue ? parseThaiDateToYmd(directValue) : null;
    if (parsedDirect) return parsedDirect;

    const markdown = String(result?.markdown ?? "").trim();
    if (!markdown) continue;
    const summary = parseAssignmentOrderSummary(
      {
        fileName: String(result?.name ?? ""),
        markdown,
      },
      personName,
    );
    const parsedFromSummary = summary?.effectiveDate
      ? parseThaiDateToYmd(summary.effectiveDate)
      : null;
    if (parsedFromSummary) return parsedFromSummary;

    const directEffectiveLine = markdown.match(
      /(?:ทั้งนี้\s*)?(?:ตั้งแต่วันที่|ต้งแต่วันที่)\s+([^\n]+)/,
    )?.[1];
    const parsedFromLine = directEffectiveLine
      ? parseThaiDateToYmd(directEffectiveLine)
      : null;
    if (parsedFromLine) return parsedFromLine;
  }
  return null;
};

export const detectProfessionFromPosition = (positionName: string): string | null => {
  const pos = positionName.trim();
  if (!pos) return null;
  if (pos.includes("ทันตแพทย์")) return "DENTIST";
  if (pos.includes("เทคนิคการแพทย์")) return "MED_TECH";
  if (pos.includes("รังสีการแพทย์") || pos.includes("รังสี")) return "RAD_TECH";
  if (pos.includes("กายภาพ")) return "PHYSIO";
  if (pos.includes("กิจกรรมบำบัด")) return "OCC_THERAPY";
  if (pos.includes("จิตวิทยา")) return "CLIN_PSY";
  if (pos.includes("หัวใจและทรวงอก")) return "CARDIO_TECH";
  if (pos.includes("เภสัชกร")) return "PHARMACIST";
  if (pos.includes("พยาบาล")) return "NURSE";
  if (pos.includes("แพทย์") && !pos.includes("การแพทย์")) return "DOCTOR";
  return null;
};

export const buildMissionGroupPrefill = (prefill: PrefillProfile): string => {
  const position = (prefill.position_name || (prefill as { position?: string }).position || "").trim();
  const dept = prefill.department?.trim();
  const subDept = prefill.sub_department?.trim();
  const deptText = dept ? `${dept}${subDept ? `/${subDept}` : ""}` : "";
  return [position, deptText].filter(Boolean).join(" ").trim();
};

export const mapEmployeeTypeFromPrefill = (
  employeeType: string,
): RequestFormData["employeeType"] => {
  const normalized = String(employeeType).trim().toUpperCase();
  const directMap: Record<string, RequestFormData["employeeType"]> = {
    CIVIL_SERVANT: "CIVIL_SERVANT",
    GOV_EMPLOYEE: "GOV_EMPLOYEE",
    GOVERNMENT_EMPLOYEE: "GOV_EMPLOYEE",
    PH_EMPLOYEE: "PH_EMPLOYEE",
    PUBLIC_HEALTH_EMPLOYEE: "PH_EMPLOYEE",
    TEMP_EMPLOYEE: "TEMP_EMPLOYEE",
    TEMPORARY_EMPLOYEE: "TEMP_EMPLOYEE",
  };

  return (
    directMap[normalized] ||
    (normalized.includes("ข้าราชการ") ? "CIVIL_SERVANT" : "") ||
    (normalized.includes("พนักงานราชการ") ? "GOV_EMPLOYEE" : "") ||
    (normalized.includes("พนักงานกระทรวงสาธารณสุข") ? "PH_EMPLOYEE" : "") ||
    (normalized.includes("ลูกจ้างชั่วคราว") ? "TEMP_EMPLOYEE" : "") ||
    "CIVIL_SERVANT"
  );
};
