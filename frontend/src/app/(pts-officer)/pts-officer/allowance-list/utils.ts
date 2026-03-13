import type { EligibilityRecord } from "@/features/request"
import {
  normalizeProfessionCode,
  resolveProfessionLabel,
} from "@/shared/constants/profession"
import { formatThaiDate } from "@/shared/utils/thai-locale"

export interface AllowancePerson {
  id: number
  prefix: string
  firstName: string
  lastName: string
  position: string
  professionCode: string
  professionLabel: string
  licenseExpiry: string
  rateGroup: string
  rateItem: string
  baseRate: number
  actualRate: number
  note?: string
}

export { normalizeProfessionCode, resolveProfessionLabel }

function formatDate(value?: string | null): string {
  return formatThaiDate(value)
}

export function formatRateItemLabel(
  itemNo: string | null | undefined,
  subItemNo: string | null | undefined,
): string {
  const baseItem = itemNo !== null && itemNo !== undefined ? String(itemNo).trim() : ""
  const nestedItem = subItemNo !== null && subItemNo !== undefined ? String(subItemNo).trim() : ""

  if (!baseItem || baseItem === "-") return "-"
  if (!nestedItem || nestedItem === "-") return baseItem
  if (nestedItem === baseItem || nestedItem.startsWith(`${baseItem}.`)) return nestedItem

  return `${baseItem}.${nestedItem}`
}

export function mapEligibility(row: EligibilityRecord): AllowancePerson {
  const rateValue = Number(row.rate_amount ?? 0)
  const groupNo = row.group_no !== null && row.group_no !== undefined ? String(row.group_no) : "-"
  const itemNo = row.item_no !== null && row.item_no !== undefined ? String(row.item_no) : "-"
  const subItemNo =
    row.sub_item_no !== null && row.sub_item_no !== undefined ? String(row.sub_item_no) : null
  const professionCode = normalizeProfessionCode(row.profession_code)

  return {
    id: row.eligibility_id,
    prefix: row.title ?? "",
    firstName: row.first_name ?? "-",
    lastName: row.last_name ?? "",
    position: row.position_name ?? "-",
    professionCode,
    professionLabel: resolveProfessionLabel(professionCode, professionCode),
    licenseExpiry: formatDate(row.latest_license_valid_until ?? row.expiry_date ?? null),
    rateGroup: groupNo,
    rateItem: formatRateItemLabel(itemNo, subItemNo),
    baseRate: rateValue,
    actualRate: rateValue,
    note: row.request_no ? `อ้างอิงคำขอ ${row.request_no}` : undefined,
  }
}

export function getRateGroupBadgeClass(rateGroup: string): string {
  if (rateGroup === "1") return "bg-primary/10 text-primary"
  if (rateGroup === "2") return "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
  if (rateGroup === "3") return "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
  return "bg-muted text-muted-foreground"
}
