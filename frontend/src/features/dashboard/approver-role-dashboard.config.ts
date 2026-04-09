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
  payrollPendingBadgeClass: string;
};

export type ApproverDashboardRoleConfig = {
  basePath: string;
  subtitle: string;
  statCards: ApproverDashboardStatCardConfig[];
  quickActions: ApproverDashboardQuickActionConfig[];
  theme: ApproverDashboardRoleTheme;
  labels: {
    pageTitle: string;
    pendingRequestsTitle: string;
    viewAllRequests: string;
    noPendingRequests: string;
    pendingPayrollsTitle: string;
    pendingPayrollBadge: string;
    noPendingPayrolls: string;
    manageAllPayrolls: string;
  };
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

const sharedDashboardTheme: ApproverDashboardRoleTheme = {
  payrollIconClass: 'text-blue-600',
  payrollPendingBadgeClass: 'text-[10px] border-amber-200 text-amber-700 bg-amber-50',
};

const sharedDashboardLabels: ApproverDashboardRoleConfig['labels'] = {
  pageTitle: 'แดชบอร์ด',
  pendingRequestsTitle: 'คำขอล่าสุดที่รออนุมัติ',
  viewAllRequests: 'ดูทั้งหมด',
  noPendingRequests: 'ไม่มีรายการรออนุมัติ',
  pendingPayrollsTitle: 'รอบจ่ายรออนุมัติ',
  pendingPayrollBadge: 'รออนุมัติ',
  noPendingPayrolls: 'ไม่พบรอบจ่ายค้าง',
  manageAllPayrolls: 'จัดการรอบจ่ายทั้งหมด',
};

const createBaseQuickActions = (basePath: string): ApproverDashboardQuickActionConfig[] => [
  {
    label: 'อนุมัติคำขอ',
    href: `${basePath}/requests`,
    icon: UserCheck,
    iconClass: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
  },
  {
    label: 'อนุมัติรอบจ่าย',
    href: `${basePath}/payroll`,
    icon: Calculator,
    iconClass: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
  },
];

const createQuickActions = (
  basePath: string,
  role: 'HEAD_HR' | 'HEAD_FINANCE',
): ApproverDashboardQuickActionConfig[] => {
  const sharedActions = createBaseQuickActions(basePath);
  if (role === 'HEAD_HR') {
    return [
      ...sharedActions,
      {
        label: 'รายงานกำหนดเวลา',
        href: `${basePath}/sla-report`,
        icon: Clock,
        iconClass: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200',
      },
      {
        label: 'รายงานอื่นๆ',
        href: `${basePath}/reports`,
        icon: ArrowRight,
        iconClass: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
      },
    ];
  }
  return [
    ...sharedActions,
    {
      label: 'รายงานอื่นๆ',
      href: `${basePath}/reports`,
      icon: ArrowRight,
      iconClass: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
      itemClassName: 'col-span-2',
    },
  ];
};

const createApproverDashboardConfig = (
  basePath: string,
  subtitle: string,
  role: 'HEAD_HR' | 'HEAD_FINANCE',
): ApproverDashboardRoleConfig => ({
  basePath,
  subtitle,
  statCards: buildStatCards(basePath),
  quickActions: createQuickActions(basePath, role),
  theme: sharedDashboardTheme,
  labels: sharedDashboardLabels,
});

export const headHrDashboardConfig: ApproverDashboardRoleConfig = createApproverDashboardConfig(
  '/head-hr',
  'ภาพรวมคำขอและรอบจ่ายเงินที่รอการพิจารณาในขั้นทรัพยากรบุคคล',
  'HEAD_HR',
);

export const headFinanceDashboardConfig: ApproverDashboardRoleConfig =
  createApproverDashboardConfig(
    '/head-finance',
    'ภาพรวมคำขอและรอบจ่ายเงินที่รอการพิจารณาในขั้นการเงิน',
    'HEAD_FINANCE',
  );
