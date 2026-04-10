import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/features/request/detail/utils";
import { cn } from "@/lib/utils";

type RequestSectionCardProps = {
  title: string;
  icon: LucideIcon;
  isComplete?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function RequestSectionCard({
  title,
  icon,
  isComplete,
  className,
  contentClassName,
  children,
}: RequestSectionCardProps) {
  return (
    <Card
      className={cn(
        "scroll-mt-20 shadow-sm transition-all duration-300 border-border/60",
        className,
      )}
    >
      <CardContent className={cn("p-6", contentClassName)}>
        <SectionHeader title={title} icon={icon} isComplete={isComplete} />
        {children}
      </CardContent>
    </Card>
  );
}
