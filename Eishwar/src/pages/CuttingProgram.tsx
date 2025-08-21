import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Scissors, Search, QrCode, Download, Upload, Play } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

// Categories from Product Details master data
import { listProductDetails } from '../services/productService';
import {
  getCuttingLots,
  downloadCuttingPlanTemplate, uploadCuttingPlan, listPendingPlans, startPlan,
  type CuttingPlan
} from '../services/cuttingService';

// Helper: normalize any API error into a readable string for toasts
const toErrorMessage = (err: any): string => {
  // Axios-style error with response
  const detail = err?.response?.data?.detail ?? err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Pydantic/FastAPI validation errors typically have an array of objects with msg
    const msgs = detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (detail && typeof detail === 'object') {
    // Try common fields
    if (typeof (detail as any).message === 'string') return (detail as any).message;
    if (typeof (detail as any).msg === 'string') return (detail as any).msg;
    try {
      return JSON.stringify(detail);
    } catch {
      /* noop */
    }
  }
  if (typeof err?.message === 'string') return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return 'An unexpected error occurred';
  }
};

const CuttingProgram: React.FC = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedCategory, setSelectedCategory] = useState('');
  // Simplified flow: only category, template, upload
  // const [selectedBundles, setSelectedBundles] = useState<number[]>([]);
  const [planFile, setPlanFile] = useState<File | null>(null);
  // Pending plans come from react-query directly


  // Queries
  const { data: productDetails = [] } = useQuery({
    queryKey: ['product-details-for-categories'],
    queryFn: () => listProductDetails().then(res => res.data),
  });
  const categories: string[] = React.useMemo(() => {
    const names = (productDetails as any[]).map((p: any) => p.category).filter(Boolean);
    return Array.from(new Set(names));
  }, [productDetails]);

  // Styles/colors/sizes loading is not required in the simplified basic info flow

  const { data: cuttingLots = [] } = useQuery({
    queryKey: ['cutting-lots'],
    queryFn: () => getCuttingLots().then(res => res.data),
  });

  // Load pending plans
  const { data: pendingPlansRaw = [], refetch: refetchPlans } = useQuery<CuttingPlan[], Error>({
    queryKey: ['cutting-plans-pending'],
    queryFn: () => listPendingPlans().then(res => res.data as CuttingPlan[]),
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });
  const pendingPlans = React.useMemo(() => (pendingPlansRaw || []).filter(p => (p?.total_pcs || 0) > 0), [pendingPlansRaw]);

  // No create mutation in this simplified flow

  // No reset needed beyond local state handling in this simplified flow

  // No manual lot creation here

  // Prefill create form from a selected pending plan
  const startFromPlan = async (p: CuttingPlan) => {
    try {
      await startPlan(p.id);
      toast.success(`Started ${p.ct_number}`);
      // Optionally navigate to lots or keep here
      setActiveTab('lots');
  await refetchPlans();
    } catch (e: any) {
  toast.error(toErrorMessage(e) || 'Failed to start plan');
    }
  };

  // Derived columns for the "Yet to Cut" grid like in the sample image
  const sizeColumns: string[] = React.useMemo(() => {
  const all = new Set<string>();
  pendingPlans.forEach(p => p.size_pcs.forEach(s => all.add(s.size_name)));
    const arr = Array.from(all);
    const rank = (n: string) => {
      const upper = (n || '').toUpperCase();
      const base: Record<string, number> = { XS: 10, S: 20, M: 30, L: 40, XL: 50 };
      if (base[upper] !== undefined) return base[upper];
      const m = upper.match(/^(\d+)XL$/); // 2XL, 3XL, etc.
      if (m) return 50 + parseInt(m[1], 10) * 10;
      if (upper.endsWith('XL')) {
        const nstr = upper.replace('XL', '');
        const num = parseInt(nstr, 10);
        if (!Number.isNaN(num)) return 50 + num * 10;
        return 60; // generic XL variant
      }
      // numeric sizes fallback
      const numOnly = parseInt(upper, 10);
      if (!Number.isNaN(numOnly)) return 100 + numOnly;
      return 1000; // unknown goes to end
    };
    arr.sort((a, b) => rank(a) - rank(b));
    return arr;
  }, [pendingPlans]);

  const buildRequiredRatio = (p: CuttingPlan) => {
    // Order ratios following sizeColumns order for consistent display
    const ratioBySize = new Map(p.size_ratios.map(r => [r.size_name, r.ratio]));
    return sizeColumns.map(size => ratioBySize.get(size) ?? 0).join(':');
  };

  const pcsFor = (p: CuttingPlan, sizeName: string) => {
    const item = p.size_pcs.find(sp => sp.size_name === sizeName);
    return item ? item.pcs : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cutting Program</h1>
        <p className="mt-2 text-gray-600">
          Create cutting programs and manage cutting lots with barcode generation
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'create', label: 'Create Program', icon: Plus },
            { id: 'lots', label: 'Cutting Lots', icon: Scissors },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'create' && (
  <div className="space-y-6">
          {/* Basic Information (Category + Template/Upload) */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <Select
                label="Category *"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                }}
                options={[
                  { value: '', label: 'Select Category' },
          ...categories.map(name => ({ value: name, label: name }))
                ]}
                required
              />
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant="secondary"
          disabled={!selectedCategory}
                  onClick={async () => {
                    try {
            const catName = selectedCategory;
            if (!catName) { toast.error('Choose a category'); return; }
            const blob = await downloadCuttingPlanTemplate(catName);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `cutting_plan_template_${catName}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch (e: any) {
                      toast.error(toErrorMessage(e) || 'Failed to download template');
                    }
                  }}
                  className="flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Plan Template for Category
                </Button>

                <div className="flex items-end gap-2">
                  <Input type="file" label="Upload Filled Plan (CSV)" onChange={(e) => setPlanFile(e.target.files?.[0] || null)} />
                  <Button
                    type="button"
          disabled={!planFile || !selectedCategory}
                    onClick={async () => {
                      try {
            const catName = selectedCategory;
            if (!catName || !planFile) return;
            const res = await uploadCuttingPlan(catName, planFile);
                        toast.success(`Uploaded ${res.data.length} plan item(s)`);
                        setPlanFile(null);
                        (document.querySelector('input[type=file]') as HTMLInputElement).value = '';
                        refetchPlans();
                      } catch (e: any) {
                        toast.error(toErrorMessage(e) || 'Upload failed');
                      }
                    }}
                    className="flex items-center"
                  >
                    <Upload className="h-4 w-4 mr-2" /> Upload
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yet to Cut (Pending Plans) under Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Yet to Cut</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CT no</TableHead>
                    <TableHead>category</TableHead>
                    <TableHead>sub_category</TableHead>
                    <TableHead>style no</TableHead>
                    <TableHead>color</TableHead>
                    <TableHead>total pcs</TableHead>
                    <TableHead>Required ratio</TableHead>
                    <TableHead colSpan={sizeColumns.length} className="text-center">All Size Ratio</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                  <TableRow>
                    {/* empty headers to align under the grouped header */}
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    {sizeColumns.map(size => (
                      <TableHead key={`sub-${size}`}>{size}</TableHead>
                    ))}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPlans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.ct_number}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.sub_category || ''}</TableCell>
                      <TableCell>{p.style_code}</TableCell>
                      <TableCell>{p.color_name}</TableCell>
                      <TableCell>{p.total_pcs}</TableCell>
                      <TableCell>{buildRequiredRatio(p)}</TableCell>
                      {sizeColumns.map(size => (
                        <TableCell key={`${p.id}-${size}`}>{pcsFor(p, size)}</TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" onClick={() => startFromPlan(p)} className="flex items-center">
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingPlans.length === 0 && (
                    <TableRow>
                      <TableCell className="text-gray-500">No pending plans</TableCell>
                      <TableCell colSpan={6 + sizeColumns.length}>&nbsp;</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
  </div>
      )}

      {activeTab === 'lots' && (
        <div className="space-y-6">
          {/* Yet to Cut (Pending Plans) */}
          <Card>
            <CardHeader>
              <CardTitle>Yet to Cut</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CT no</TableHead>
                    <TableHead>category</TableHead>
                    <TableHead>sub_category</TableHead>
                    <TableHead>style no</TableHead>
                    <TableHead>color</TableHead>
                    <TableHead>total pcs</TableHead>
                    <TableHead>Required ratio</TableHead>
                    <TableHead colSpan={sizeColumns.length} className="text-center">All Size Ratio</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    {sizeColumns.map(size => (
                      <TableHead key={`lots-sub-${size}`}>{size}</TableHead>
                    ))}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPlans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.ct_number}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.sub_category || ''}</TableCell>
                      <TableCell>{p.style_code}</TableCell>
                      <TableCell>{p.color_name}</TableCell>
                      <TableCell>{p.total_pcs}</TableCell>
                      <TableCell>{buildRequiredRatio(p)}</TableCell>
                      {sizeColumns.map(size => (
                        <TableCell key={`${p.id}-${size}`}>{pcsFor(p, size)}</TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" onClick={async () => {
                          try {
                            await startPlan(p.id);
                            toast.success(`Started ${p.ct_number}`);
                            refetchPlans();
                            setActiveTab('create');
                          } catch (e: any) {
                            toast.error(toErrorMessage(e) || 'Failed to start plan');
                          }
                        }} className="flex items-center">
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingPlans.length === 0 && (
                    <TableRow>
                      <TableCell className="text-gray-500">No pending plans</TableCell>
                      <TableCell colSpan={6 + sizeColumns.length}>&nbsp;</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cutting Lots Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cutting Lots ({cuttingLots.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Fabric Lot</TableHead>
                    <TableHead>Total Pieces</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuttingLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <Badge variant="info">{lot.lot_number}</Badge>
                      </TableCell>
                      <TableCell>Style {lot.style_id}</TableCell>
                      <TableCell>Color {lot.color_id}</TableCell>
                      <TableCell>{lot.fabric_lot}</TableCell>
                      <TableCell className="font-medium">{lot.total_pieces}</TableCell>
                      <TableCell>{new Date(lot.cutting_date).toLocaleDateString()}</TableCell>
                      <TableCell>{lot.created_by}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // Navigate to lot details
                              console.log('View lot details:', lot.id);
                            }}
                          >
                            <Search className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // Generate stickers for this lot's bundles
                              console.log('Generate stickers for lot:', lot.id);
                            }}
                          >
                            <QrCode className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {cuttingLots.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No cutting lots found. Create your first cutting program to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CuttingProgram;