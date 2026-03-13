"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SummaryMetricCard({
  icon: Icon,
  title,
  value,
  iconClassName,
  iconBgClassName,
  layout = "horizontal",
  iconPlacement = "inline",
  cardClassName,
  contentClassName,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  iconClassName: string;
  iconBgClassName: string;
  layout?: "horizontal" | "split";
  iconPlacement?: "inline" | "edge";
  cardClassName?: string;
  contentClassName?: string;
}) {
  const isSplit = layout === "split";
  const isEdgePlacement = !isSplit && iconPlacement === "edge";
  return (
    <Card className={cn("border-border shadow-sm", cardClassName)}>
      <CardContent
        className={cn(
          isSplit
            ? "p-6 flex items-center justify-between"
            : isEdgePlacement
              ? "flex items-center justify-between gap-4 p-4"
              : "flex items-center gap-4 p-4",
          contentClassName,
        )}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isSplit ? (
            <div className="text-2xl font-bold mt-1">{value}</div>
          ) : (
            <div className="text-xl font-bold tracking-tight">{value}</div>
          )}
        </div>
        <div className={cn(isSplit ? "p-3 rounded-full" : "rounded-xl p-3", iconBgClassName)}>
          <Icon className={cn("h-5 w-5", iconClassName)} />
        </div>
      </CardContent>
    </Card>
  );
}
