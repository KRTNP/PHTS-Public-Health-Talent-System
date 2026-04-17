import { Briefcase, Building2, User } from "lucide-react";
import { RequestInfoItem } from "./RequestInfoItem";
import { RequestSectionCard } from "./RequestSectionCard";

type RequestRequesterInfoSectionProps = {
  requesterName: string;
  citizenId?: string | null;
  positionName: string;
  positionNumber: string;
  department: string;
  subDepartment: string;
};

export function RequestRequesterInfoSection({
  requesterName,
  citizenId,
  positionName,
  positionNumber,
  department,
  subDepartment,
}: RequestRequesterInfoSectionProps) {
  return (
    <RequestSectionCard title="ข้อมูลผู้ยื่นคำขอ" icon={User}>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
        <RequestInfoItem label="ชื่อ-นามสกุล" value={requesterName} icon={User} className="sm:col-span-2" />
        <RequestInfoItem label="เลขประจำตัวประชาชน" value={citizenId ?? "-"} />
        <div className="col-span-full border-t border-border/50 my-2" />
        <RequestInfoItem label="ตำแหน่ง" value={positionName} icon={Briefcase} className="sm:col-span-2" />
        <RequestInfoItem label="เลขที่ตำแหน่ง" value={positionNumber} />
        <RequestInfoItem label="กลุ่มงาน" value={department} icon={Building2} />
        <RequestInfoItem label="หน่วยงาน" value={subDepartment} />
      </dl>
    </RequestSectionCard>
  );
}
