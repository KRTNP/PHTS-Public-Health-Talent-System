/**
 * Frontend Request API client
 *
 * Handles HTTP calls for PTS request management (no direct DB access).
 */
import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import {
  CreateRequestDTO,
  PTSRequest,
  RequestWithDetails,
} from '@/types/request.types';

const extractErrorMessage = (error: unknown, fallbackMessage: string) => {
  const err = error as { response?: { data?: { error?: string; message?: string } } };
  return err.response?.data?.error || err.response?.data?.message || fallbackMessage;
};

const buildRequestFormData = (
  data: CreateRequestDTO,
  files: File[] = [],
  signatureFile?: File,
  licenseFile?: File
) => {
  const formData = new FormData();

  formData.append('personnel_type', data.personnel_type);
  formData.append('position_number', data.position_number);
  if (data.department_group) formData.append('department_group', data.department_group);
  if (data.main_duty) formData.append('main_duty', data.main_duty);

  formData.append('work_attributes', JSON.stringify(data.work_attributes));

  formData.append('request_type', data.request_type);
  if (data.requested_amount !== undefined) {
    formData.append('requested_amount', data.requested_amount.toString());
  }
  if (data.effective_date) {
    formData.append('effective_date', data.effective_date);
  }

  if (licenseFile) {
    formData.append('license_file', licenseFile);
  }

  files.forEach((file) => formData.append('files', file));
  if (signatureFile) {
    formData.append('applicant_signature', signatureFile);
  }

  return formData;
};

/**
 * Create a new PTS request (optionally with files/signature)
 */
export async function createRequest(
  data: CreateRequestDTO,
  files: File[] = [],
  signatureFile?: File,
  licenseFile?: File
): Promise<RequestWithDetails> {
  try {
    const formData = buildRequestFormData(data, files, signatureFile, licenseFile);

    const response = await apiClient.post<ApiResponse<RequestWithDetails>>(
      '/api/requests',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to create request'));
  }
}

/**
 * Submit a draft request for approval workflow
 */
export async function submitRequest(requestId: number): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${requestId}/submit`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to submit request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to submit request'));
  }
}

/**
 * Get all requests created by the current user
 */
export async function getMyRequests(): Promise<RequestWithDetails[]> {
  try {
    const response = await apiClient.get<ApiResponse<RequestWithDetails[]>>('/api/requests');

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch requests');
    }

    return response.data.data || [];
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'ไม่สามารถเรียกดูข้อมูลคำขอได้'));
  }
}

/**
 * Scope item for multi-scope dropdown
 */
export interface ScopeItem {
  value: string;
  label: string;
  type: 'UNIT' | 'DEPT';
}

/**
 * Get user's available scopes for multi-scope dropdown
 * (HEAD_WARD and HEAD_DEPT only)
 */
export async function getMyScopes(): Promise<ScopeItem[]> {
  try {
    const response = await apiClient.get<ApiResponse<ScopeItem[]>>(
      '/api/requests/my-scopes'
    );

    if (!response.data.success) {
      return [];
    }

    return response.data.data || [];
  } catch (error: unknown) {
    console.warn('Unable to fetch scopes:', error);
    return [];
  }
}

/**
 * Get pending requests for approvers
 * @param scope - Optional scope filter for multi-scope users
 */
export async function getPendingRequests(scope?: string): Promise<RequestWithDetails[]> {
  try {
    const params = scope ? { scope } : {};
    const response = await apiClient.get<ApiResponse<RequestWithDetails[]>>(
      '/api/requests/pending',
      { params }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch pending requests');
    }

    return response.data.data || [];
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to fetch pending requests'));
  }
}

/**
 * Get a specific request by ID
 */
export async function getRequestById(id: number): Promise<RequestWithDetails> {
  try {
    const response = await apiClient.get<ApiResponse<RequestWithDetails>>(`/api/requests/${id}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to fetch request'));
  }
}

/**
 * Approve a request
 */
export async function approveRequest(id: number, comment?: string): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/approve`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to approve request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to approve request'));
  }
}

/**
 * Reject a request
 */
export async function rejectRequest(id: number, comment: string): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/reject`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to reject request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to reject request'));
  }
}

/**
 * Return a request to the previous step
 */
export async function returnRequest(id: number, comment: string): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/return`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to return request');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to return request'));
  }
}

/**
 * Batch approve multiple requests (Director/Head Finance only)
 */
export async function batchApproveRequests(
  requestIds: number[],
  comment?: string
): Promise<{ success: number[]; failed: any[] }> {
  try {
    const response = await apiClient.post<ApiResponse<{ success: number[]; failed: any[] }>>(
      '/api/requests/batch-approve',
      { requestIds, comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to batch approve');
    }

    return response.data.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Batch approval failed'));
  }
}

/**
 * Get approval history for the current approver
 */
export async function getApprovalHistory(): Promise<PTSRequest[]> {
  try {
    const response = await apiClient.get<ApiResponse<PTSRequest[]>>('/api/requests/history');

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch approval history');
    }

    return response.data.data || [];
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Unable to fetch approval history'));
  }
}
