import { Card, CardContent } from "@/components/ui/card";
import { formatThaiNumber } from "@/shared/utils/thai-locale";

type RequestAmountSummaryCardProps = {
  amount?: number | null;
};

export function RequestAmountSummaryCard({ amount }: RequestAmountSummaryCardProps) {
  return (
    <Card className="shadow-sm border-primary/20 bg-primary/5 overflow-hidden">
      <CardContent className="p-6">
        <p className="text-sm font-medium text-primary/80 mb-1">ยอดเงินเบิกจ่าย</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary">{formatThaiNumber(amount ?? 0)}</span>
          <span className="text-sm text-primary/80">บาท</span>
        </div>
      </CardContent>
    </Card>
  );
}
