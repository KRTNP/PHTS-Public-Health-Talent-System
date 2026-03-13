"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search, UserRound } from "lucide-react";
import { RequestWizard } from "@/features/request";
import { usePersonnelOptions } from "@/features/request";
import type { PersonnelOption } from "@/features/request";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const fullName = (person: PersonnelOption) =>
  `${person.title ?? ""}${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
  person.citizen_id;

export default function NewOfficerRequestPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PersonnelOption | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { data: options = [], isLoading } = usePersonnelOptions(deferredSearch, 20);

  const selectedLabel = useMemo(() => {
    if (!selected) return "";
    return fullName(selected);
  }, [selected]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/pts-officer/requests"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการคำขอที่รอดำเนินการ
        </Link>
        <h1 className="text-2xl font-bold text-foreground">สร้างคำขอแทนบุคลากร</h1>
        <p className="mt-1 text-muted-foreground">
          เลือกบุคลากรจากในระบบ แล้วใช้ฟอร์มคำขอเดิมในการบันทึกสิทธิ พ.ต.ส.
        </p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5 text-primary" />
            เลือกบุคลากร
          </CardTitle>
          <CardDescription>
            ค้นหาจากชื่อ-สกุล หรือเลขบัตรประชาชน ระบบจะให้เลือกเฉพาะบุคลากรที่มีอยู่ในระบบเท่านั้น
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่อ-สกุล หรือเลขบัตรประชาชน"
              className="pl-9"
            />
          </div>

          {selected ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="font-semibold text-emerald-700">{selectedLabel}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selected.position_name || "ไม่ระบุตำแหน่ง"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{selected.citizen_id}</Badge>
                    {selected.department ? <Badge variant="secondary">{selected.department}</Badge> : null}
                    {selected.sub_department ? (
                      <Badge variant="secondary">{selected.sub_department}</Badge>
                    ) : null}
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  เปลี่ยนบุคลากร
                </Button>
              </div>
            </div>
          ) : search.trim().length < 2 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
              พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหาบุคลากร
            </div>
          ) : (
            <ScrollArea className="h-80 rounded-xl border border-border">
              <div className="divide-y">
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">กำลังค้นหาข้อมูล...</div>
                ) : options.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    ไม่พบบุคลากรที่ตรงกับคำค้น
                  </div>
                ) : (
                  options.map((person) => (
                    <button
                      key={`${person.user_id}-${person.citizen_id}`}
                      type="button"
                      onClick={() => setSelected(person)}
                      className={cn(
                        "flex w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-muted/50",
                      )}
                    >
                      <span className="font-medium text-foreground">{fullName(person)}</span>
                      <span className="text-sm text-muted-foreground">
                        {person.position_name || "ไม่ระบุตำแหน่ง"}
                      </span>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{person.citizen_id}</span>
                        {person.department ? <span>{person.department}</span> : null}
                        {person.sub_department ? <span>{person.sub_department}</span> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <RequestWizard
          prefillUserId={selected.user_id}
          returnPath="/pts-officer/requests"
        />
      ) : null}
    </div>
  );
}
