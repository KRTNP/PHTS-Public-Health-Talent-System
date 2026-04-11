import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RequestSectionHeaderProps = {
  title: string;
  icon: LucideIcon;
  isComplete?: boolean;
};

export function RequestSectionHeader({ title, icon: Icon, isComplete }: RequestSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${isComplete ? "bg-emerald-100" : "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${isComplete ? "text-emerald-600" : "text-primary"}`} />
        </div>
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
      </div>
      {isComplete ? (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 hidden sm:flex"
        >
          <CheckCircle2 className="w-3 h-3" />
          ตรวจสอบครบแล้ว
        </Badge>
      ) : null}
    </div>
  );
}
