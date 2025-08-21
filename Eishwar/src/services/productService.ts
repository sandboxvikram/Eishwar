import api from './api';

export type SubCategory = 'top' | 'bottom' | '';

export interface ProductDetail {
  id: number;
  category: string;
  subCategory?: SubCategory | null;
  styleNo?: string | null;
  allColors?: string | null; // comma-separated
  allSizes?: string | null; // comma-separated
  cutParts?: string | null; // name of cut parts
  cutCost?: number | null;
  printCost?: number | null;
  stitchCost?: number | null;
  ironCost?: number | null;
  created_at?: string;
  updated_at?: string | null;
}

export type ProductDetailCreate = Omit<ProductDetail, 'id' | 'created_at' | 'updated_at'>;
export type ProductDetailUpdate = Partial<ProductDetailCreate>;

// Backend API calls
export function listProductDetails() {
  return api.get<ProductDetail[]>('/master/product-details/');
}

export function createProductDetail(data: ProductDetailCreate) {
  // Map camelCase -> snake_case for backend
  const payload = {
    category: data.category,
    sub_category: data.subCategory ?? null,
    style_no: data.styleNo ?? null,
    all_colors: data.allColors ?? null,
    all_sizes: data.allSizes ?? null,
    cut_parts: data.cutParts ?? null,
    cut_cost: data.cutCost ?? null,
    print_cost: data.printCost ?? null,
    stitch_cost: data.stitchCost ?? null,
    iron_cost: data.ironCost ?? null,
  };
  return api.post<ProductDetail>('/master/product-details/', payload);
}

export function updateProductDetailApi(id: number, data: ProductDetailUpdate) {
  const payload = {
    category: data.category,
    sub_category: data.subCategory,
    style_no: data.styleNo,
    all_colors: data.allColors,
    all_sizes: data.allSizes,
    cut_parts: data.cutParts,
    cut_cost: data.cutCost,
    print_cost: data.printCost,
    stitch_cost: data.stitchCost,
    iron_cost: data.ironCost,
  };
  return api.put<ProductDetail>(`/master/product-details/${id}`, payload);
}

export function deleteProductDetailApi(id: number) {
  return api.delete(`/master/product-details/${id}`);
}

// Fixed categories helpers (client-side persistence for future additions)
const FC_KEY = 'fixedCategories';

export function getFixedCategories(): string[] {
  const defaults = ['night set', 'M. night set', 'M. leggings', 'long top', 'cycling short'];
  const raw = localStorage.getItem(FC_KEY);
  const saved = raw ? (JSON.parse(raw) as string[]) : [];
  const set = new Set<string>([...defaults, ...saved]);
  return Array.from(set);
}

export function addFixedCategory(name: string) {
  const raw = localStorage.getItem(FC_KEY);
  const saved = raw ? (JSON.parse(raw) as string[]) : [];
  if (!saved.includes(name)) {
    saved.push(name);
    localStorage.setItem(FC_KEY, JSON.stringify(saved));
  }
}
