import api from './api';

export interface StitchingUnit {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address: string;
  capacity_per_day: number;
  rate_per_piece: number;
  is_active: boolean;
  created_at: string;
}

export interface DCItem {
  id: number;
  bundle_id: number;
  quantity_sent: number;
  quantity_returned: number;
  quantity_ok: number;
  quantity_rejected: number;
}

export interface DeliveryChallan {
  id: number;
  dc_number: string;
  stitching_unit_id: number;
  cutting_lot_id: number;
  dc_date: string;
  total_pieces_sent: number;
  total_pieces_returned: number;
  status: 'open' | 'partial' | 'hold' | 'cleared';
  qr_code_data: string;
  qr_code_path?: string;
  dispatch_date?: string;
  expected_return_date?: string;
  actual_return_date?: string;
  hold_reason?: string;
  notes?: string;
  dc_items?: DCItem[];
  created_at: string;
}

export interface CreateDCRequest {
  stitching_unit_id: number;
  cutting_lot_id: number;
  expected_return_date?: string;
  notes?: string;
  dc_items: Array<{
    bundle_id: number;
    quantity_sent: number;
  }>;
}

// Stitching Units
export const getStitchingUnits = (isActive?: boolean) =>
  api.get<StitchingUnit[]>('/stitching/units/', { params: { is_active: isActive } });

export const createStitchingUnit = (data: Omit<StitchingUnit, 'id' | 'created_at'>) =>
  api.post<StitchingUnit>('/stitching/units/', data);

export const updateStitchingUnit = (unitId: number, data: Partial<StitchingUnit>) =>
  api.put<StitchingUnit>(`/stitching/units/${unitId}`, data);

// Delivery Challans
export const createDeliveryChallan = (data: CreateDCRequest) =>
  api.post<DeliveryChallan>('/stitching/delivery-challans/', data);

export const getDeliveryChallans = (params?: {
  status?: string;
  unit_id?: number;
  skip?: number;
  limit?: number;
}) =>
  api.get<DeliveryChallan[]>('/stitching/delivery-challans/', { params });

export const getDeliveryChallan = (dcId: number) =>
  api.get<DeliveryChallan>(`/stitching/delivery-challans/${dcId}`);

export const updateDeliveryChallan = (dcId: number, data: Partial<DeliveryChallan>) =>
  api.put<DeliveryChallan>(`/stitching/delivery-challans/${dcId}`, data);

export const getDCItems = (dcId: number) =>
  api.get(`/stitching/delivery-challans/${dcId}/items/`);

export const getStitchingDashboard = () =>
  api.get<{
    dc_status: {
      open: number;
      partial: number;
      hold: number;
      cleared: number;
    };
    active_units: number;
  }>('/stitching/stats/dashboard/');