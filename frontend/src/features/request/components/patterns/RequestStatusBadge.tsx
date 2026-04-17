import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { getRequestStatusColor, getRequestStatusLabel } from "@/features/request/shared/status";
import { cn } from "@/lib/utils";

type RequestStatusBadgeProps = {
  status?: string | null;
  currentStep?: number | null;
  icon?: ReactNode;
  label?: string;
  className?: string;
};

export function RequestStatusBadge({
  status,
  currentStep,
  icon,
  label,
  className,
}: RequestStatusBadgeProps) {
  if (!status) return null;

  return (
    <Badge variant="outline" className={cn(getRequestStatusColor(status), className)}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {label ?? getRequestStatusLabel(status, currentStep)}
    </Badge>
  );
}
