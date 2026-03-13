import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccessReviewQueueStatus } from '@/features/access-review/shared';

export type AccessReviewPayloadEntry = {
  key: string;
  label: string;
  value: string;
};

const PAYLOAD_LABELS: Record<string, string> = {
  expected_role: 'บทบาทที่ควรเป็น',
  current_role: 'บทบาทปัจจุบัน',
  previous_role: 'บทบาทเดิม',
  employee_status: 'สถานะบุคลากร',
  status_code: 'รหัสสถานะ',
  expected_is_active: 'สถานะบัญชีที่ควรเป็น',
  current_is_active: 'สถานะบัญชีปัจจุบัน',
  profile_changed_fields: 'ฟิลด์ที่เปลี่ยน',
  source: 'แหล่งที่มา',
  sync_batch_id: 'รอบซิงก์',
  reason: 'เหตุผล',
};

export const getQueueReasonLabel = (reasonCode: string) => {
  switch (reasonCode) {
    case 'NEW_USER':
      return 'ผู้ใช้ใหม่จากรอบซิงก์';
    case 'ROLE_MISMATCH':
      return 'บทบาทไม่ตรงกติกา';
    case 'PROFILE_CHANGED':
      return 'ข้อมูลบุคลากรเปลี่ยน';
    case 'INACTIVE_BUT_ACTIVE':
      return 'บุคลากรไม่พร้อมใช้งาน แต่บัญชีเปิดอยู่';
    default:
      return reasonCode;
  }
};

export const getQueueStatusBadge = (status: AccessReviewQueueStatus) => {
  switch (status) {
    case 'OPEN':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-700"
        >
          <AlertTriangle className="h-3 w-3" /> ค้างตรวจ
        </Badge>
      );
    case 'IN_REVIEW':
      return (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          กำลังตรวจ
        </Badge>
      );
    case 'RESOLVED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
        >
          <CheckCircle2 className="h-3 w-3" /> ปิดแล้ว
        </Badge>
      );
    case 'DISMISSED':
      return (
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
          ยกเลิกเคส
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const formatPayloadValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map((item) => formatPayloadValue(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key}: ${formatPayloadValue(entryValue)}`)
      .join(' | ');
  }
  return String(value);
};

export const getPayloadEntries = (
  payload?: Record<string, unknown> | null,
): AccessReviewPayloadEntry[] => {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: PAYLOAD_LABELS[key] ?? key,
      value: formatPayloadValue(value),
    }));
};
