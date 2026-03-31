import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  FileCheck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

export type ApproverStatKey = 'pending_requests' | 'pending_payrolls' | 'approved_month' | 'sla_overdue';

export type ApproverDashboardStatCardConfig = {
  key: ApproverStatKey;
  title: string;
  subtext: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  href: string;
};

export type ApproverDashboardQuickActionConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
  itemClassName?: string;
};

export type ApproverDashboardRoleTheme = {
  payrollIconClass: string;
};

export type ApproverDashboardRoleConfig = {
  basePath: string;
  subtitle: string;
  statCards: ApproverDashboardStatCardConfig[];
  quickActions: ApproverDashboardQuickActionConfig[];
  theme: ApproverDashboardRoleTheme;
};

const buildStatCards = (basePath: string): ApproverDashboardStatCardConfig[] => [
  {
    key: 'pending_requests',
    title: 'คำขอรออนุมัติ',
    subtext: 'ต้องตรวจสอบ',
    icon: FileCheck,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    href: `${basePath}/requests`,
  },
  {
    key: 'pending_payrolls',
    title: 'รอบจ่ายรออนุมัติ',
    subtext: 'รอบเดือนปัจจุบัน',
    icon: Calculator,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    href: `${basePath}/payroll`,
  },
  {
    key: 'approved_month',
    title: 'อนุมัติแล้ว (เดือนนี้)',
    subtext: 'คำขอที่อนุมัติแล้ว',
    icon: CheckCircle2,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    href: `${basePath}/requests?status=approved`,
  },
  {
    key: 'sla_overdue',
    title: 'เกินกำหนดเวลา',
    subtext: 'คำขอที่ล่าช้า',
    icon: AlertTriangle,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    href: `${basePath}/requests?status=overdue`,
  },
];

export const headHrDashboardConfig: ApproverDashboardRoleConfig = {
  basePath: '/head-hr',
  subtitle: 'ภาพรวมคำขอและรอบจ่ายเงินที่รอการพิจารณาในขั้นทรัพยากรบุคคล',
  statCards: buildStatCards('/head-hr'),
  quickActions: [
    {
      label: 'อนุมัติคำขอ',
      href: '/head-hr/requests',
      icon: UserCheck,
      iconClass: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
    },
    {
      label: 'อนุมัติรอบจ่าย',
      href: '/head-hr/payroll',
      icon: Calculator,
      iconClass: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
    },
    {
      label: 'รายงานกำหนดเวลา',
      href: '/head-hr/sla-report',
      icon: Clock,
      iconClass: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200',
    },
    {
      label: 'รายงานอื่นๆ',
      href: '/head-hr/reports',
      icon: ArrowRight,
      iconClass: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
    },
  ],
  theme: {
    payrollIconClass: 'text-blue-600',
  },
};

export const headFinanceDashboardConfig: ApproverDashboardRoleConfig = {
  basePath: '/head-finance',
  subtitle: 'ภาพรวมคำขอและรอบจ่ายเงินที่รอการพิจารณาในขั้นการเงิน',
  statCards: buildStatCards('/head-finance'),
  quickActions: [
    {
      label: 'อนุมัติคำขอ',
      href: '/head-finance/requests',
      icon: UserCheck,
      iconClass: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
    },
    {
      label: 'อนุมัติรอบจ่าย',
      href: '/head-finance/payroll',
      icon: Calculator,
      iconClass: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
    },
    {
      label: 'รายงานอื่นๆ',
      href: '/head-finance/reports',
      icon: ArrowRight,
      iconClass: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
      itemClassName: 'col-span-2',
    },
  ],
  theme: {
    payrollIconClass: 'text-blue-600',
  },
};
