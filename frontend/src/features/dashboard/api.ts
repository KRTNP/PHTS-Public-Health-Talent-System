/**
 * dashboard module - API client
 *
 */
import api from "@/shared/api/axios";
import type { ApiResponse } from "@/shared/api/types";
import type { RequestStatus } from "@/types/request.types";

export type UserDashboardStats = {
  total: number;
  pending: number;
  approved: number;
  unread: number;
  pending_steps: number[];
  total_trend: string;
  total_trend_up: boolean;
  pending_trend?: string;
  pending_trend_up?: boolean;
  approved_trend: string;
  approved_trend_up: boolean;
  unread_trend: string;
  unread_trend_up: boolean;
};

export type UserDashboardRecentRequest = {
  request_id: number;
  display_id: string;
  month_label: string;
  amount: string;
  status: RequestStatus;
  status_label: string;
  step: number;
  submitted_label: string;
};

export type UserDashboardAnnouncement = {
  id: number;
  title: string;
  date: string;
  priority: "high" | "normal" | "low";
};

export type UserDashboardPayload = {
  stats: UserDashboardStats;
  recent_requests: UserDashboardRecentRequest[];
  announcements: UserDashboardAnnouncement[];
};

export type ApproverDashboardStats = {
  pending_requests: number;
  pending_payrolls: number;
  approved_month: number;
  sla_overdue: number;
};

export type ApproverPendingRequest = {
  id: string;
  name: string;
  position: string;
  department: string;
  amount: number;
  date: string;
  sla_status: "normal" | "warning" | "danger" | "overdue";
};

export type ApproverPendingPayroll = {
  id: string;
  month: string;
  totalAmount: number;
  totalPersons: number;
  submittedAt: string;
};

export type ApproverDashboardPayload = {
  stats: ApproverDashboardStats;
  pending_requests: ApproverPendingRequest[];
  pending_payrolls: ApproverPendingPayroll[];
};

export async function getUserDashboard() {
  const res =
    await api.get<ApiResponse<UserDashboardPayload>>("/dashboard/user");
  return res.data.data;
}

export async function getApproverDashboard() {
  const res =
    await api.get<ApiResponse<ApproverDashboardPayload>>("/dashboard/approver");
  return res.data.data;
}

// Backward-compatible aliases during migration.
export type HeadHrDashboardStats = ApproverDashboardStats;
export type HeadHrPendingRequest = ApproverPendingRequest;
export type HeadHrPendingPayroll = ApproverPendingPayroll;
export type HeadHrDashboardPayload = ApproverDashboardPayload;
export const getHeadHrDashboard = getApproverDashboard;
