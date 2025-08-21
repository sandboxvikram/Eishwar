import api from './api';

export interface CuttingLot {
  id: number;
  lot_number: string;
  style_id: number;
  color_id: number;
  fabric_lot: string;
  lay_number: number;
  total_pieces: number;
  cutting_date: string;
  created_by: string;
  notes?: string;
  created_at: string;
}

export interface Bundle {
  id: number;
  bundle_number: string;
  cutting_lot_id: number;
  size_id: number;
  panel_type: 'front' | 'back' | 'sleeve' | 'collar' | 'cuff' | 'pocket';
  quantity: number;
  barcode_data: string;
  qr_code_path?: string;
  barcode_path?: string;
  status: 'created' | 'dispatched' | 'returned';
  created_at: string;
}

export interface SizeRatio {
  size_id: number;
  size_name: string;
  ratio: number;
}

export interface CuttingProgramRequest {
  style_id: number;
  color_id: number;
  fabric_lot: string;
  lay_number: number;
  size_ratios: SizeRatio[];
  panel_types: Array<'front' | 'back' | 'sleeve' | 'collar' | 'cuff' | 'pocket'>;
  total_lays: number;
  created_by: string;
  notes?: string;
}

export interface CuttingProgramResponse {
  cutting_lot: CuttingLot;
  bundles: Bundle[];
  total_bundles: number;
  total_pieces: number;
  summary: Record<string, number>;
}

export interface BunchStickerData {
  bundle_id: number;
  bundle_number: string;
  style_name: string;
  color_name: string;
  size_name: string;
  panel_type: string;
  quantity: number;
  lot_number: string;
  barcode_data: string;
  qr_code_url: string;
  barcode_url: string;
}

export interface CuttingPlanSizeRatioItem {
  size_id: number;
  size_name: string;
  ratio: number;
}

export interface CuttingPlanSizePcsItem {
  size_id: number;
  size_name: string;
  pcs: number;
}

export interface CuttingPlan {
  id: number;
  ct_number: string;
  category: string;
  sub_category?: string | null;
  style_id: number;
  style_code: string;
  color_id: number;
  color_name: string;
  total_pcs: number;
  size_ratios: CuttingPlanSizeRatioItem[];
  size_pcs: CuttingPlanSizePcsItem[];
  status: 'pending' | 'started' | 'completed';
  created_at: string;
  updated_at?: string | null;
}

// Cutting Program
export const createCuttingProgram = (data: CuttingProgramRequest) =>
  api.post<CuttingProgramResponse>('/cutting/program/', data);

export const getCuttingLots = (skip = 0, limit = 100) =>
  api.get<CuttingLot[]>('/cutting/lots/', { params: { skip, limit } });

export const getCuttingLot = (lotId: number) =>
  api.get<CuttingLot>(`/cutting/lots/${lotId}`);

export const getLotBundles = (lotId: number) =>
  api.get<Bundle[]>(`/cutting/lots/${lotId}/bundles/`);

export const getBundle = (bundleId: number) =>
  api.get<Bundle>(`/cutting/bundles/${bundleId}`);

export const generateBunchStickers = (bundleIds: number[]) =>
  api.post<{ stickers: BunchStickerData[]; total_stickers: number }>('/cutting/bunch-stickers/', {
    bundle_ids: bundleIds
  });

export const searchBundles = (params: {
  lot_number?: string;
  bundle_number?: string;
  status?: string;
}) =>
  api.get<Bundle[]>('/cutting/bundles/search/', { params });

export const getCuttingSummary = () =>
  api.get<{
    total_lots: number;
    bundle_status: {
      created: number;
      dispatched: number;
      returned: number;
    };
  }>('/cutting/stats/summary/');

// Cutting Plans (Yet-to-Cut)
export const downloadCuttingPlanTemplate = async (category: string) => {
  const res = await api.get(`/cutting/plans/template`, { params: { category }, responseType: 'blob' });
  return res.data as Blob;
};

export const uploadCuttingPlan = (category: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<CuttingPlan[]>(`/cutting/plans/upload`, formData, {
    params: { category },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listPendingPlans = () => api.get<CuttingPlan[]>(`/cutting/plans/pending`);

export const startPlan = (planId: number) => api.post<CuttingPlan>(`/cutting/plans/${planId}/start`);