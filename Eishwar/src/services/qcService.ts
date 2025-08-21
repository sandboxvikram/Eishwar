import api from './api';

export interface QRScanRequest {
  qr_code_data: string;
  scanner_name: string;
  scan_type: 'outbound' | 'inbound';
  scanned_quantity: number;
  notes?: string;
}

export interface QRScanResponse {
  success: boolean;
  message: string;
  dc_id?: number;
  expected_quantity: number;
  scanned_quantity: number;
  is_match: boolean;
  variance: number;
  new_status?: string;
}

export interface QCRecord {
  id: number;
  dc_id: number;
  scan_type: string;
  scan_datetime: string;
  scanned_quantity: number;
  expected_quantity: number;
  is_match: boolean;
  variance: number;
  scanner_name: string;
  notes?: string;
  created_at: string;
}

export interface StitchReturn {
  id: number;
  dc_id: number;
  bundle_id: number;
  return_date: string;
  quantity_returned: number;
  return_type: 'ok' | 'reject';
  defect_description?: string;
  inspector_name: string;
  notes?: string;
  created_at: string;
}

// QR Scanning
export const processQRScan = (data: QRScanRequest) =>
  api.post<QRScanResponse>('/qc/scan/', data);

// DC Management for QC
export const getDCsForQC = (params?: {
  status?: string;
  unit_id?: number;
}) =>
  api.get('/qc/delivery-challans/', { params });

export const getDCScanHistory = (dcId: number) =>
  api.get<QCRecord[]>(`/qc/delivery-challans/${dcId}/history/`);

export const manualStatusUpdate = (
  dcId: number,
  newStatus: string,
  reason: string,
  updatedBy = 'Manual'
) =>
  api.put(`/qc/delivery-challans/${dcId}/status/`, null, {
    params: {
      new_status: newStatus,
      reason,
      updated_by: updatedBy,
    },
  });

// Stitch Returns
export const createStitchReturn = (data: Omit<StitchReturn, 'id' | 'created_at'>) =>
  api.post<StitchReturn>('/qc/stitch-returns/', data);

export const getStitchReturns = (params?: {
  dc_id?: number;
  return_type?: 'ok' | 'reject';
  skip?: number;
  limit?: number;
}) =>
  api.get<StitchReturn[]>('/qc/stitch-returns/', { params });

// QC Statistics
export const getQCSummary = () =>
  api.get<{
    today_scans: number;
    scan_accuracy: {
      matches: number;
      mismatches: number;
      accuracy_rate: number;
    };
    returns: {
      ok: number;
      reject: number;
      reject_rate: number;
    };
  }>('/qc/stats/summary/');

export const getPendingDCs = () =>
  api.get('/qc/delivery-challans/pending/');