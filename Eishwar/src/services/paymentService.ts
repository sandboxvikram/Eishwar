import api from './api';

export interface Payment {
  id: number;
  payment_number: string;
  stitching_unit_id: number;
  payment_date: string;
  total_pieces: number;
  rate_per_piece: number;
  gross_amount: number;
  deduction_amount: number;
  net_amount: number;
  status: 'pending' | 'cleared';
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_by: string;
  cleared_date?: string;
  created_at: string;
}

export interface PaymentCalculationRequest {
  stitching_unit_id: number;
  from_date: string;
  to_date: string;
  dc_ids?: number[];
}

export interface PaymentCalculationResponse {
  stitching_unit_id: number;
  unit_name: string;
  total_pieces: number;
  rate_per_piece: number;
  gross_amount: number;
  suggested_deduction: number;
  net_amount: number;
  dc_list: Array<{
    dc_id: number;
    dc_number: string;
    stitching_unit_id: number;
    total_pieces_returned: number;
    total_ok_pieces: number;
    rate_per_piece: number;
    amount: number;
  }>;
}

export interface CreatePaymentRequest {
  stitching_unit_id: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_by: string;
  dc_ids: number[];
  deduction_amount?: number;
  net_amount: number;
}

// Payment Calculation
export const calculatePayment = (data: PaymentCalculationRequest) =>
  api.post<PaymentCalculationResponse>('/payments/calculate/', data);

// Payments
export const createPayment = (data: CreatePaymentRequest) =>
  api.post<Payment>('/payments/', data);

export const getPayments = (params?: {
  from_date?: string;
  to_date?: string;
  unit_id?: number;
  status?: 'pending' | 'cleared';
}) =>
  api.get<Payment[]>('/payments/', { params });

export const getPayment = (paymentId: number) =>
  api.get<Payment>(`/payments/${paymentId}`);

export const updatePayment = (paymentId: number, data: Partial<Payment>) =>
  api.put<Payment>(`/payments/${paymentId}`, data);

export const clearPayment = (paymentId: number, clearedDate?: string) =>
  api.put(`/payments/${paymentId}/clear/`, null, {
    params: { cleared_date: clearedDate },
  });

// Payment Statistics
export const getPendingPaymentsSummary = () =>
  api.get('/payments/summary/pending/');

export const getUnitClearedDCs = (unitId: number, params?: {
  from_date?: string;
  to_date?: string;
}) =>
  api.get(`/payments/units/${unitId}/cleared-dcs/`, { params });

export const getPaymentDashboard = () =>
  api.get<{
    this_month: {
      total_payments: number;
      total_amount: number;
      pending_amount: number;
      cleared_amount: number;
    };
    pending_by_unit: Record<string, {
      unit_name: string;
      total_amount: number;
      payment_count: number;
    }>;
  }>('/payments/stats/dashboard/');