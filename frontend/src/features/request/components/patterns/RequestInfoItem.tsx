import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type RequestInfoItemProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function RequestInfoItem({ label, value, icon: Icon, className }: RequestInfoItemProps) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5 opacity-70" /> : null}
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground break-words">{value}</dd>
    </div>
  );
}
