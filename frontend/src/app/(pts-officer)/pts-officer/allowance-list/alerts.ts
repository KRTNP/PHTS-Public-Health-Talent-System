import { ELIGIBILITY_EXPIRING_DAYS } from "@/features/request";
import { formatThaiDate as formatThaiDateValue } from "@/shared/utils/thai-locale";
import { isPermanentLicenseDate } from "@/shared/utils/license";

export type AllowanceAlert = {
  title: string;
  detail?: string;
  severity: "error" | "warning";
};

export type AllowanceAlertSource = {
  active_eligibility_count?: number | null;
  upcoming_change_type?: string | null;
  upcoming_change_effective_date?: string | null;
  latest_license_status?: string | null;
  latest_license_valid_until?: string | null;
  original_status?: string | null;
};

const formatThaiDate = (value?: string | null) => formatThaiDateValue(value);

const getLicenseStatusLabel = (status?: string | null) => {
  switch (String(status ?? "").trim().toUpperCase()) {
    case "EXPIRED":
      return "หมดอายุ";
    case "INACTIVE":
      return "ไม่อยู่ในสถานะใช้งาน";
    case "ACTIVE":
      return "ใช้งานได้";
    default:
      return status ? String(status) : "ไม่ทราบสถานะ";
  }
};

const getPersonnelChangeLabel = (changeType?: string | null) => {
  switch (String(changeType ?? "").trim().toUpperCase()) {
    case "RETIREMENT":
      return "เกษียณอายุ";
    case "RESIGN":
      return "ลาออก";
    case "TRANSFER_OUT":
      return "ย้ายออก";
    default:
      return "เปลี่ยนสถานะ";
  }
};

export function buildAllowanceAlerts(
  row: AllowanceAlertSource,
  now = new Date(),
): AllowanceAlert[] {
  const alerts: AllowanceAlert[] = [];
  const licenseStatus = String(row.latest_license_status ?? "").trim().toUpperCase();
  const validUntil = row.latest_license_valid_until ?? null;

  if (!licenseStatus && !validUntil) {
    alerts.push({
      title: "ไม่มีข้อมูลใบอนุญาต",
      detail: "ยังไม่พบข้อมูลใบอนุญาตวิชาชีพล่าสุดในระบบ",
      severity: "error",
    });
  } else if (licenseStatus && licenseStatus !== "ACTIVE") {
    alerts.push({
      title: "ใบอนุญาตไม่พร้อมใช้งาน",
      detail: validUntil && !isPermanentLicenseDate(validUntil)
        ? `สถานะ ${getLicenseStatusLabel(licenseStatus)} (สิ้นสุด ${formatThaiDate(validUntil)})`
        : `สถานะ ${getLicenseStatusLabel(licenseStatus)}`,
      severity: "error",
    });
  } else if (validUntil && !isPermanentLicenseDate(validUntil)) {
    const expiry = new Date(validUntil);
    if (!Number.isNaN(expiry.getTime())) {
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        alerts.push({
          title: "ใบอนุญาตหมดอายุ",
          detail: `หมดอายุเมื่อ ${formatThaiDate(validUntil)}`,
          severity: "error",
        });
      } else if (diffDays <= ELIGIBILITY_EXPIRING_DAYS) {
        alerts.push({
          title: "ใบอนุญาตใกล้หมดอายุ",
          detail: `หมดอายุวันที่ ${formatThaiDate(validUntil)} (เหลือ ${diffDays} วัน)`,
          severity: "warning",
        });
      }
    }
  }

  const activeEligibilityCount = Number(row.active_eligibility_count ?? 0);
  if (Number.isFinite(activeEligibilityCount) && activeEligibilityCount > 1) {
    alerts.push({
      title: "พบสิทธิซ้ำ",
      detail: `บุคลากรคนนี้มีสิทธิที่ยังใช้งานอยู่ ${activeEligibilityCount} รายการ`,
      severity: "error",
    });
  }

  if (row.upcoming_change_type && row.upcoming_change_effective_date) {
    alerts.push({
      title: "มีการเปลี่ยนสถานะใกล้ถึงกำหนด",
      detail: `${getPersonnelChangeLabel(row.upcoming_change_type)} วันที่ ${formatThaiDate(
        row.upcoming_change_effective_date,
      )}`,
      severity: "warning",
    });
  }

  const status = String(row.original_status ?? "").trim();
  if (status && /(ลา|ลาออก|เกษีย|ศึกษาต่อ|พ้นสภาพ|ไม่ปฏิบัติ|พักงาน)/.test(status)) {
    alerts.push({ title: "สถานะบุคลากรต้องตรวจสอบ", detail: status, severity: "warning" });
  }

  return alerts;
}
