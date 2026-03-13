import { SummaryMetricCard } from '@/components/common';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <SummaryMetricCard
      icon={Icon}
      title={title}
      value={
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold tracking-tight">{formatThaiNumber(value)}</span>
          <span className="text-xs font-normal text-muted-foreground">รายการ</span>
        </div>
      }
      iconClassName={colorClass}
      iconBgClassName={bgClass}
      layout="split"
    />
  );
}
