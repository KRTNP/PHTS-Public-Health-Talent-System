import { CreditCard } from "lucide-react";
import { formatThaiNumber } from "@/shared/utils/thai-locale";
import { RequestInfoItem } from "./RequestInfoItem";
import { RequestSectionCard } from "./RequestSectionCard";

type RateDisplay = {
  professionLabel?: string | null;
  groupLabel?: string | null;
  criteriaLabel?: string | null;
  subCriteriaLabel?: string | null;
};

type RequestEligibilityInfoSectionProps = {
  requestTypeLabel: string;
  personnelTypeLabel: string;
  effectiveDateLabel?: string | null;
  mainDuty: string;
  workAttributes: string[];
  isRateMappingEmpty: boolean;
  rateDisplay?: RateDisplay | null;
  rateAmount?: number | string | null;
};

export function RequestEligibilityInfoSection({
  requestTypeLabel,
  personnelTypeLabel,
  effectiveDateLabel,
  mainDuty,
  workAttributes,
  isRateMappingEmpty,
  rateDisplay,
  rateAmount,
}: RequestEligibilityInfoSectionProps) {
  return (
    <RequestSectionCard title="รายละเอียดสิทธิ พ.ต.ส." icon={CreditCard}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 mb-6">
        <RequestInfoItem label="ประเภทคำขอ" value={requestTypeLabel} className="sm:col-span-2" />
        <RequestInfoItem label="ประเภทบุคลากร" value={personnelTypeLabel} />
        <RequestInfoItem label="วันที่เริ่มมีสิทธิ" value={effectiveDateLabel || "-"} />
        <RequestInfoItem label="งานที่ได้รับมอบหมาย" value={mainDuty} className="sm:col-span-2" />
        <RequestInfoItem
          label="ลักษณะงาน"
          value={workAttributes.length > 0 ? workAttributes.join(", ") : "-"}
          className="sm:col-span-2"
        />
      </div>

      <div className="bg-muted/30 rounded-lg p-5 border border-border/50">
        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full" />
          ผลการประเมินสิทธิ พ.ต.ส.
        </h4>

        {isRateMappingEmpty ? (
          <div className="text-sm text-muted-foreground text-center py-4 italic">
            ยังไม่มีผลการประเมินสิทธิ
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
            <RequestInfoItem label="วิชาชีพ" value={rateDisplay?.professionLabel || "-"} />
            <RequestInfoItem label="กลุ่ม" value={rateDisplay?.groupLabel || "-"} />
            <RequestInfoItem
              label="เงื่อนไขหลัก"
              value={rateDisplay?.criteriaLabel || "-"}
              className="sm:col-span-2"
            />
            <RequestInfoItem
              label="เงื่อนไขย่อย"
              value={rateDisplay?.subCriteriaLabel || "-"}
              className="sm:col-span-2"
            />

            <div className="sm:col-span-2 mt-2 pt-4 border-t border-border/50 flex justify-between items-center">
              <span className="text-sm font-medium">อัตราเงินตามสิทธิ</span>
              <span className="text-lg font-bold text-primary">
                {rateAmount !== null && rateAmount !== undefined
                  ? formatThaiNumber(Number(rateAmount))
                  : "-"}
                <span className="text-sm font-normal text-muted-foreground ml-1">บาท/เดือน</span>
              </span>
            </div>
          </dl>
        )}
      </div>
    </RequestSectionCard>
  );
}
