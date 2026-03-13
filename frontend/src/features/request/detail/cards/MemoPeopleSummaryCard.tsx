import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Sparkles, CheckCircle2 } from 'lucide-react';

type Props = {
  people: string[];
  personName?: string;
};

const normalize = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase();

export function MemoPeopleSummaryCard({ people, personName }: Props) {
  const normalizedPerson = normalize(personName ?? '');

  // ตรรกะการเรียงลำดับ: นำคนที่ Matching สำเร็จขึ้นมาไว้บนสุดเสมอ
  const sortedPeople = [...people].sort((a, b) => {
    const isMatchA = normalizedPerson && normalize(a) === normalizedPerson;
    const isMatchB = normalizedPerson && normalize(b) === normalizedPerson;
    if (isMatchA && !isMatchB) return -1;
    if (!isMatchA && isMatchB) return 1;
    return 0;
  });

  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* ใช้โครงสร้าง Header รูปแบบเดียวกับ AssignmentOrderSummaryCard */}
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              รายชื่อที่พบในหนังสือนำส่ง
            </CardTitle>
            <CardDescription className="mt-1">
              รายชื่อบุคลากรที่สกัดได้จากเอกสารในชุดนี้
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 font-normal flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Sparkles className="w-3 h-3" />
            อ่านด้วย OCR
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
            <p className="text-sm">ไม่พบรายชื่อในเอกสาร หรือ OCR ไม่สามารถอ่านได้</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedPeople.map((person) => {
              const matched = normalizedPerson && normalize(person) === normalizedPerson;
              return (
                <Badge
                  key={person}
                  variant="outline"
                  className={
                    matched
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 pr-3'
                      : 'text-muted-foreground font-normal hover:text-foreground'
                  }
                >
                  {matched && <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                  {person}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
