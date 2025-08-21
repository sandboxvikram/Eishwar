import api from './api';

export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface Style {
  id: number;
  name: string;
  code: string;
  category_id: number;
  description?: string;
  created_at: string;
  category?: Category;
}

export interface Color {
  id: number;
  name: string;
  code: string;
  style_id: number;
  hex_value?: string;
  created_at: string;
  style?: Style;
}

export interface Size {
  id: number;
  name: string;
  code: string;
  color_id: number;
  sort_order: number;
  created_at: string;
  color?: Color;
}

export interface BulkUploadItem {
  category: string;
  style_name: string;
  style_code: string;
  color_name: string;
  color_code: string;
  color_hex?: string;
  size_name: string;
  size_code: string;
  size_order: number;
}

// Categories
export const getCategories = () => 
  api.get<Category[]>('/master/categories/');

export const createCategory = (data: Omit<Category, 'id' | 'created_at'>) =>
  api.post<Category>('/master/categories/', data);

// Styles
export const getStyles = (categoryId?: number) =>
  api.get<Style[]>('/master/styles/', { params: { category_id: categoryId } });

export const createStyle = (data: Omit<Style, 'id' | 'created_at' | 'category'>) =>
  api.post<Style>('/master/styles/', data);

// Colors
export const getColors = (styleId?: number) =>
  api.get<Color[]>('/master/colors/', { params: { style_id: styleId } });

export const createColor = (data: Omit<Color, 'id' | 'created_at' | 'style'>) =>
  api.post<Color>('/master/colors/', data);

// Sizes
export const getSizes = (colorId?: number) =>
  api.get<Size[]>('/master/sizes/', { params: { color_id: colorId } });

export const createSize = (data: Omit<Size, 'id' | 'created_at' | 'color'>) =>
  api.post<Size>('/master/sizes/', data);

// Bulk Upload
export const bulkUploadMasterData = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post('/master/bulk-upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// Fabric Bills
export interface FabricBill {
  id: number;
  bill_number: string;
  supplier_name: string;
  bill_date: string;
  bill_month: number;
  bill_year: number;
  fabric_type: string;
  quantity_meters: number;
  rate_per_meter: number;
  total_amount: number;
  gst_amount: number;
  final_amount: number;
  created_at: string;
}

export const getFabricBills = (month?: number, year?: number) =>
  api.get<FabricBill[]>('/master/fabric-bills/', { params: { month, year } });

export const createFabricBill = (data: Omit<FabricBill, 'id' | 'created_at'>) =>
  api.post<FabricBill>('/master/fabric-bills/', data);

// Accessory Bills
export interface AccessoryBill {
  id: number;
  bill_number: string;
  supplier_name: string;
  bill_date: string;
  bill_month: number;
  bill_year: number;
  accessory_type: string;
  description: string;
  quantity: number;
  rate_per_unit: number;
  total_amount: number;
  gst_amount: number;
  final_amount: number;
  created_at: string;
}

export const getAccessoryBills = (month?: number, year?: number) =>
  api.get<AccessoryBill[]>('/master/accessory-bills/', { params: { month, year } });

export const createAccessoryBill = (data: Omit<AccessoryBill, 'id' | 'created_at'>) =>
  api.post<AccessoryBill>('/master/accessory-bills/', data);