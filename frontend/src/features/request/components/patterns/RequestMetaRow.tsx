import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RequestMetaRowProps = {
  label: string;
  value: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function RequestMetaRow({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: RequestMetaRowProps) {
  return (
    <div className={cn("flex justify-between", className)}>
      <span className={cn("text-muted-foreground", labelClassName)}>{label}</span>
      <span className={cn("text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}
