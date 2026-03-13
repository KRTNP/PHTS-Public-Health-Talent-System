'use client';

import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThaiDateField } from '@/components/thai-date-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PersonPicker } from '@/components/person-picker';
import { CalendarCheck, Eye, Save, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import type { LeaveReturnReportEvent } from '@/features/leave-management/core/api';
import { leaveTypes } from '@/features/leave-management/core/constants';
import {
  isValidDateRange,
  validateOptionalDateRange,
} from '@/features/leave-management/utils/dateRange';
import {
  buildReturnReportPayload,
  deriveReturnReportMode,
  type ReturnReportMode,
} from '@/features/leave-management/utils/returnReportForm';
import { cn } from '@/lib/utils';

function toDateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).split('T')[0].split(' ')[0] || '';
}

function DateInputField({
  label,
  value,
  onChange,
  name,
  disabled,
  min,
  max,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn(required && 'flex justify-between')}>
        <span>
          {label} {required && <span className="text-destructive">*</span>}
        </span>
      </Label>
      <ThaiDateField
        name={name}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
        className="bg-background shadow-sm"
      />
    </div>
  );
}

// --- Component: AddLeaveForm ---
export function AddLeaveForm({
  onClose,
  onSave,
  personnel,
  onPreview,
}: {
  onClose: () => void;
  onSave: (leave: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] }) => void;
  personnel: { id: string; name: string; position: string; department: string }[];
  onPreview: (url: string, name: string) => void;
}) {
  const [selectedPerson, setSelectedPerson] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [userStartDate, setUserStartDate] = useState('');
  const [userEndDate, setUserEndDate] = useState('');
  const [documentStartDate, setDocumentStartDate] = useState('');
  const [documentEndDate, setDocumentEndDate] = useState('');
  const [requireReport, setRequireReport] = useState(false);
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [field, setField] = useState('');
  const [studyStartDate, setStudyStartDate] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const person = personnel.find((p) => p.id === selectedPerson);

  const calculateDays = () => {
    if (!userStartDate || !userEndDate) return 1;
    const start = new Date(userStartDate);
    const end = new Date(userEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const nextFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...nextFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = () => {
    if (!selectedPerson || !leaveType || !userStartDate || !userEndDate) return;

    if (!isValidDateRange(userStartDate, userEndDate)) {
      toast.error('วันที่สิ้นสุด (ตามระบบ) ต้องไม่ก่อนวันที่เริ่ม');
      return;
    }

    const docError = validateOptionalDateRange(documentStartDate, documentEndDate, 'ตามเอกสาร');
    if (docError) {
      toast.error(docError);
      return;
    }

    const newLeave: Partial<LeaveRecord> = {
      personId: selectedPerson,
      personName: person?.name || '',
      personPosition: person?.position || '',
      personDepartment: person?.department || '',
      type: leaveType,
      userStartDate,
      userEndDate,
      documentStartDate: documentStartDate || undefined,
      documentEndDate: documentEndDate || undefined,
      days: calculateDays(),
      requireReport,
      note: note || undefined,
      studyInfo:
        leaveType === 'education'
          ? {
              institution,
              program,
              field,
              startDate: studyStartDate,
            }
          : undefined,
    };

    onSave({ ...newLeave, files });
  };

  const userDateRangeValid =
    Boolean(userStartDate) && Boolean(userEndDate)
      ? isValidDateRange(userStartDate, userEndDate)
      : true;
  const docDateRangeError = validateOptionalDateRange(
    documentStartDate,
    documentEndDate,
    'ตามเอกสาร',
  );
  const docDateRangeValid = !docDateRangeError;
  const isFormValid =
    selectedPerson &&
    leaveType &&
    userStartDate &&
    userEndDate &&
    userDateRangeValid &&
    docDateRangeValid;

  return (
    <div className="space-y-6">
      {/* 1. ข้อมูลหลัก */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex justify-between">
            <span>
              เลือกบุคลากร <span className="text-destructive">*</span>
            </span>
          </Label>
          <PersonPicker
            persons={personnel.map((p) => ({
              id: p.id,
              name: p.name,
              position: p.position,
              department: p.department,
            }))}
            value={selectedPerson}
            onChange={setSelectedPerson}
            placeholder="ค้นหาชื่อ หรือรหัสบุคลากร..."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex justify-between">
            <span>
              ประเภทการลา <span className="text-destructive">*</span>
            </span>
          </Label>
          <Select
            value={leaveType}
            onValueChange={(value) => {
              setLeaveType(value);
              setRequireReport(['education', 'ordain', 'military'].includes(value));
            }}
          >
            <SelectTrigger className="bg-background shadow-sm">
              <SelectValue placeholder="เลือกประเภทการลา" />
            </SelectTrigger>
            <SelectContent>
              {leaveTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <DateInputField
            label="วันที่เริ่ม (ระบบ)"
            value={userStartDate}
            onChange={setUserStartDate}
            name="user_start_date"
            max={userEndDate || undefined}
            required
          />
          <DateInputField
            label="วันที่สิ้นสุด (ระบบ)"
            value={userEndDate}
            onChange={setUserEndDate}
            name="user_end_date"
            min={userStartDate || undefined}
            required
          />
        </div>
        {!userDateRangeValid && userStartDate && userEndDate && (
          <p className="text-xs text-destructive mt-1">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม</p>
        )}
      </div>

      {/* 2. ข้อมูลเอกสาร & รายงานตัว */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <h3 className="text-sm font-semibold text-foreground">ข้อมูลอ้างอิงและเงื่อนไขเพิ่มเติม</h3>
        <div className="grid grid-cols-2 gap-4">
          <DateInputField
            label="วันที่เริ่ม (ตามเอกสาร)"
            value={documentStartDate}
            onChange={setDocumentStartDate}
            name="document_start_date"
            max={documentEndDate || undefined}
          />
          <DateInputField
            label="วันที่สิ้นสุด (ตามเอกสาร)"
            value={documentEndDate}
            onChange={setDocumentEndDate}
            name="document_end_date"
            min={documentStartDate || undefined}
          />
        </div>
        {!docDateRangeValid && docDateRangeError && (
          <p className="text-xs text-destructive mt-1">{docDateRangeError}</p>
        )}

        <div className="flex items-center space-x-2 bg-muted/20 p-3 rounded-lg border border-border/50">
          <Checkbox
            id="requireReport"
            checked={requireReport}
            onCheckedChange={(checked) => setRequireReport(checked === true)}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="requireReport" className="font-medium cursor-pointer">
            ต้องรายงานตัวหลังกลับมาปฏิบัติงาน
          </Label>
        </div>
      </div>

      {/* 3. ข้อมูลลาศึกษาต่อ (ถ้ามี) */}
      {leaveType === 'education' && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-purple-700">
            ข้อมูลการลาไปศึกษา ฝึกอบรม หรือดูงาน
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-purple-900/80">สถานศึกษา / สถานที่อบรม</Label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="เช่น มหาวิทยาลัยเชียงใหม่"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-purple-900/80">หลักสูตร</Label>
              <Input
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="เช่น ปริญญาโท"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-purple-900/80">สาขาวิชา</Label>
              <Input
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="เช่น วิทยาการคอมพิวเตอร์"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <DateInputField
                label="วันที่เริ่มศึกษา/อบรม"
                value={studyStartDate}
                onChange={setStudyStartDate}
                name="study_start_date"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. ไฟล์แนบและหมายเหตุ */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="space-y-2">
          <Label>เอกสารแนบ (ถ้ามี)</Label>
          <div className="relative">
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="pl-10 bg-background shadow-sm file:text-muted-foreground file:font-medium"
            />
            <UploadCloud className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          {files.length > 0 && (
            <div className="space-y-2 mt-3">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-foreground">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreview(URL.createObjectURL(file), file.name)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(idx)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
            className="bg-background shadow-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="w-full sm:w-auto gap-2 shadow-sm"
        >
          <Save className="h-4 w-4" /> บันทึกข้อมูล
        </Button>
      </div>
    </div>
  );
}

// --- Component: EditLeaveForm ---
export function EditLeaveForm({
  leave,
  onClose,
  onSave,
  onPreview,
}: {
  leave: LeaveRecord;
  onClose: () => void;
  onSave: (leave: LeaveRecord & { files?: File[] }) => void;
  onPreview: (url: string, name: string) => void;
}) {
  // Logic remains mostly the same, applying similar UI patterns as AddLeaveForm
  const [leaveType] = useState(leave.type);
  const [userStartDate, setUserStartDate] = useState(leave.userStartDate);
  const [userEndDate, setUserEndDate] = useState(leave.userEndDate);
  const [documentStartDate, setDocumentStartDate] = useState(leave.documentStartDate || '');
  const [documentEndDate, setDocumentEndDate] = useState(leave.documentEndDate || '');
  const [requireReport, setRequireReport] = useState(leave.requireReport);
  const [institution, setInstitution] = useState(leave.studyInfo?.institution || '');
  const [program, setProgram] = useState(leave.studyInfo?.program || '');
  const [field, setField] = useState(leave.studyInfo?.field || '');
  const [studyStartDate, setStudyStartDate] = useState(leave.studyInfo?.startDate || '');
  const [note, setNote] = useState(leave.note || '');
  const [files, setFiles] = useState<File[]>([]);

  const calculateDays = () => {
    if (!userStartDate || !userEndDate) return 1;
    const start = new Date(userStartDate);
    const end = new Date(userEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = () => {
    if (!isValidDateRange(userStartDate, userEndDate)) {
      toast.error('วันที่สิ้นสุด (ตามระบบ) ต้องไม่ก่อนวันที่เริ่ม');
      return;
    }

    const docError = validateOptionalDateRange(documentStartDate, documentEndDate, 'ตามเอกสาร');
    if (docError) {
      toast.error(docError);
      return;
    }

    const updatedLeave: LeaveRecord = {
      ...leave,
      type: leave.type, // Cannot change type in edit usually, but keeping state just in case
      userStartDate,
      userEndDate,
      documentStartDate: documentStartDate || undefined,
      documentEndDate: documentEndDate || undefined,
      days: calculateDays(),
      requireReport,
      reportStatus: requireReport ? leave.reportStatus || 'pending' : undefined,
      note: note || undefined,
      studyInfo:
        leaveType === 'education'
          ? { institution, program, field, startDate: studyStartDate }
          : undefined,
    };

    onSave({ ...updatedLeave, files });
  };

  const userDateRangeValid = isValidDateRange(userStartDate, userEndDate);
  const docDateRangeError = validateOptionalDateRange(
    documentStartDate,
    documentEndDate,
    'ตามเอกสาร',
  );
  const docDateRangeValid = !docDateRangeError;
  const isFormValid = userStartDate && userEndDate && userDateRangeValid && docDateRangeValid;

  return (
    <div className="space-y-6">
      {/* Read-only User Summary */}
      <div className="p-4 rounded-xl bg-muted/20 border shadow-sm flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
          {leave.personName.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{leave.personName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leave.personPosition} • {leave.personDepartment}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>ประเภทการลา (อ้างอิงจากระบบ)</Label>
          <div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center text-sm font-medium text-muted-foreground cursor-not-allowed">
            {leave.typeName}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <DateInputField
            label="วันที่เริ่ม (ระบบ)"
            value={userStartDate}
            onChange={setUserStartDate}
            name="edit_user_start_date"
            max={userEndDate || undefined}
            required
          />
          <DateInputField
            label="วันที่สิ้นสุด (ระบบ)"
            value={userEndDate}
            onChange={setUserEndDate}
            name="edit_user_end_date"
            min={userStartDate || undefined}
            required
          />
        </div>
        {!userDateRangeValid && userStartDate && userEndDate && (
          <p className="text-xs text-destructive mt-1">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม</p>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-border/50">
        <h3 className="text-sm font-semibold text-foreground">ข้อมูลอ้างอิงและเงื่อนไข</h3>
        <div className="grid grid-cols-2 gap-4">
          <DateInputField
            label="วันที่เริ่ม (ตามเอกสาร)"
            value={documentStartDate}
            onChange={setDocumentStartDate}
            name="edit_document_start_date"
            max={documentEndDate || undefined}
          />
          <DateInputField
            label="วันที่สิ้นสุด (ตามเอกสาร)"
            value={documentEndDate}
            onChange={setDocumentEndDate}
            name="edit_document_end_date"
            min={documentStartDate || undefined}
          />
        </div>
        {!docDateRangeValid && docDateRangeError && (
          <p className="text-xs text-destructive mt-1">{docDateRangeError}</p>
        )}

        <div className="flex items-center space-x-2 bg-muted/20 p-3 rounded-lg border border-border/50">
          <Checkbox
            id="requireReportEdit"
            checked={requireReport}
            onCheckedChange={(checked) => setRequireReport(checked === true)}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="requireReportEdit" className="font-medium cursor-pointer">
            ต้องรายงานตัวหลังกลับมาปฏิบัติงาน
          </Label>
        </div>
      </div>

      {leaveType === 'education' && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-purple-700">ข้อมูลการลาศึกษาต่อ / อบรม</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-purple-900/80">สถานศึกษา / สถานที่อบรม</Label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="ระบุสถานศึกษา"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-purple-900/80">หลักสูตร</Label>
              <Input
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="ระบุหลักสูตร"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-purple-900/80">สาขาวิชา</Label>
              <Input
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="bg-background shadow-sm"
                placeholder="ระบุสาขาวิชา"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <DateInputField
                label="วันที่เริ่มศึกษา/อบรม"
                value={studyStartDate}
                onChange={setStudyStartDate}
                name="edit_study_start_date"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="space-y-2">
          <Label>เพิ่มเอกสารแนบใหม่ (ไม่บังคับ)</Label>
          <div className="relative">
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="pl-10 bg-background shadow-sm file:text-muted-foreground file:font-medium"
            />
            <UploadCloud className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          {files.length > 0 && (
            <div className="space-y-2 mt-3">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-foreground">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreview(URL.createObjectURL(file), file.name)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(idx)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
            className="bg-background shadow-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="w-full sm:w-auto gap-2 shadow-sm"
        >
          <Save className="h-4 w-4" /> บันทึกการแก้ไข
        </Button>
      </div>
    </div>
  );
}

// --- Component: RecordReportForm ---
export function RecordReportForm({
  leave,
  initialEvent,
  onClose,
  onSave,
}: {
  leave: LeaveRecord | null;
  initialEvent?: LeaveReturnReportEvent | null;
  onClose: () => void;
  onSave: (payload: {
    reportDate: string;
    resumeDate?: string;
    note: string;
    resumeStudyProgram?: string;
  }) => void;
}) {
  const [reportDate, setReportDate] = useState(toDateOnly(initialEvent?.report_date));
  const [resumeDate, setResumeDate] = useState(toDateOnly(initialEvent?.resume_date));
  const [note, setNote] = useState('');
  const [resumeStudyProgram, setResumeStudyProgram] = useState(
    initialEvent?.resume_study_program ?? '',
  );
  const [reportMode, setReportMode] = useState<ReturnReportMode>(
    deriveReturnReportMode(initialEvent ?? null),
  );

  const isEducation = leave?.type === 'education';
  const isEditMode = Boolean(initialEvent);
  const isResumeStudyMode = isEducation && reportMode === 'resume_study';

  const isFormValid = reportDate && (!isResumeStudyMode || !resumeDate || resumeDate > reportDate);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <DateInputField
          label="วันที่รายงานตัว"
          value={reportDate}
          onChange={setReportDate}
          name="report_date"
          required
        />

        {isEducation && (
          <div className="space-y-1.5">
            <Label>การดำเนินการหลังรายงานตัว</Label>
            <Select
              value={reportMode}
              onValueChange={(value) => setReportMode(value as ReturnReportMode)}
            >
              <SelectTrigger className="bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="return_to_work">กลับมาปฏิบัติงานตามปกติ</SelectItem>
                <SelectItem value="resume_study">กลับไปศึกษาต่อ/อบรมต่อ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isResumeStudyMode && (
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <DateInputField
              label="วันที่กลับไปศึกษาต่อ/อบรมต่อ"
              value={resumeDate}
              onChange={setResumeDate}
              name="resume_date"
              min={reportDate || undefined}
            />
            {resumeDate && resumeDate <= reportDate && (
              <p className="text-xs text-destructive mt-1">
                วันที่กลับไปศึกษาต่อต้องหลังจากวันที่รายงานตัว
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-purple-900/80">หลักสูตรที่จะกลับไปเรียนต่อ</Label>
              <Input
                value={resumeStudyProgram}
                onChange={(e) => setResumeStudyProgram(e.target.value)}
                placeholder="ระบุหลักสูตร (ถ้ามี)"
                className="bg-background shadow-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                หากยังไม่ทราบแน่ชัด สามารถบันทึกเฉพาะวันรายงานตัวก่อนได้
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
            className="bg-background shadow-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          ยกเลิก
        </Button>
        <Button
          onClick={() =>
            onSave(
              buildReturnReportPayload({
                mode: isEducation ? reportMode : 'return_to_work',
                reportDate: toDateOnly(reportDate),
                resumeDate: toDateOnly(resumeDate) || undefined,
                note,
                resumeStudyProgram,
              }),
            )
          }
          disabled={!isFormValid}
          className="w-full sm:w-auto gap-2 shadow-sm"
        >
          <CalendarCheck className="h-4 w-4" />
          {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกการรายงานตัว'}
        </Button>
      </div>
    </div>
  );
}
