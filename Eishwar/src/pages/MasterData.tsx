import React, { useState } from 'react';
import { Plus, Download, Trash2, Pencil, FileSpreadsheet, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

import { ProductDetail, listProductDetails, createProductDetail, updateProductDetailApi, deleteProductDetailApi, getFixedCategories, addFixedCategory, SubCategory } from '../services/productService';

const MasterData: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'bills'>('products');
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [editing, setEditing] = useState<ProductDetail | null>(null);
  const [newFixedCategory, setNewFixedCategory] = useState('');

  // Map server snake_case -> client camelCase
  const toClient = (s: any): ProductDetail => ({
    id: s.id,
    category: s.category,
    subCategory: s.sub_category ?? null,
    styleNo: s.style_no ?? null,
    allColors: s.all_colors ?? null,
    allSizes: s.all_sizes ?? null,
    cutParts: s.cut_parts ?? null,
    cutCost: s.cut_cost ?? null,
    printCost: s.print_cost ?? null,
    stitchCost: s.stitch_cost ?? null,
    ironCost: s.iron_cost ?? null,
    created_at: s.created_at,
    updated_at: s.updated_at,
  });

  const handleSaveProduct = () => {
    if (!editing) return;
    if (!editing.category) {
      toast.error('Category is required');
      return;
    }
    if ((editing.category === 'night set' || editing.category === 'M. night set') && !editing.subCategory) {
      toast.error('Sub category is required for selected category');
      return;
    }
  if (editing.id) {
      updateProductDetailApi(editing.id as number, {
        category: editing.category,
        subCategory: editing.subCategory,
        styleNo: editing.styleNo,
        allColors: editing.allColors,
        allSizes: editing.allSizes,
        cutParts: editing.cutParts,
        cutCost: editing.cutCost ?? undefined,
        printCost: editing.printCost ?? undefined,
        stitchCost: editing.stitchCost ?? undefined,
        ironCost: editing.ironCost ?? undefined,
      }).then((res) => {
    const updated = toClient(res.data as any);
    const next = products.map(p => (p.id === editing.id ? updated : p));
        setProducts(next);
        toast.success('Product updated');
        setEditing(null);
      }).catch((e) => toast.error(e.response?.data?.detail || 'Update failed'));
    } else {
      createProductDetail({
        category: editing.category,
        subCategory: editing.subCategory || '',
        styleNo: editing.styleNo || '',
        allColors: editing.allColors || '',
        allSizes: editing.allSizes || '',
        cutParts: editing.cutParts || '',
        cutCost: editing.cutCost ?? null,
        printCost: editing.printCost ?? null,
        stitchCost: editing.stitchCost ?? null,
        ironCost: editing.ironCost ?? null,
      }).then((res) => {
  const created = toClient(res.data as any);
  setProducts([created, ...products]);
        toast.success('Product added');
        setEditing(null);
      }).catch((e) => toast.error(e.response?.data?.detail || 'Create failed'));
    }
  };

  const startAdd = () => {
    setEditing({
      id: 0 as any,
      category: '',
      subCategory: '' as SubCategory,
      styleNo: '',
      allColors: '',
      allSizes: '',
      cutParts: '',
      cutCost: undefined,
      printCost: undefined,
      stitchCost: undefined,
      ironCost: undefined,
    });
  };

  const onDelete = (id: number) => {
    deleteProductDetailApi(id)
      .then(() => {
        setProducts(products.filter(p => p.id !== id));
        toast.success('Deleted');
      })
      .catch((e) => toast.error(e.response?.data?.detail || 'Delete failed'));
  };

  const onAddFixedCategory = () => {
    const name = newFixedCategory.trim();
    if (!name) return;
    addFixedCategory(name);
    setNewFixedCategory('');
    toast.success('Category added to fixed list');
  };

  const downloadTemplate = () => {
    // Headers per requirement
    const headers = [
      'category',
      'sub_category',
      'style_no',
      'all_colors',
      'all_sizes',
      'cut_parts',
      'cut_cost',
      'print_cost',
      'stitch_cost',
      'iron_cost',
    ];

    // Prefilled rows: only category and sub_category when applicable
    const catOptions = getFixedCategories();
    const rows: string[] = [];
    for (const cat of catOptions) {
      if (cat === 'night set' || cat === 'M. night set') {
        for (const sub of ['top', 'bottom']) {
          rows.push([cat, sub, '', '', '', '', '', '', '', ''].join(','));
        }
      } else {
        rows.push([cat, '', '', '', '', '', '', '', '', ''].join(','));
      }
    }
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_details_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Initial fetch
  React.useEffect(() => {
    listProductDetails()
      .then((res) => setProducts((res.data as any[]).map(toClient)))
      .catch(() => setProducts([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Master Data Management</h1>
        <p className="mt-2 text-gray-600">Manage Product Details and Monthly Bills</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'products', label: 'Product Details' },
            { id: 'bills', label: 'Monthly Bills' },
          ].map((tab: any) => (
            <button
              key={tab.id}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Template + Fixed Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileSpreadsheet className="h-5 w-5 mr-2" />
                Product Details Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Button variant="secondary" onClick={downloadTemplate} className="flex items-center">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <span className="text-sm text-gray-500">Prefilled with Category and Sub Category only</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <Input
                    label="Add Fixed Category (future use)"
                    placeholder="e.g., new product group"
                    value={newFixedCategory}
                    onChange={(e) => setNewFixedCategory(e.target.value)}
                  />
                </div>
                <Button onClick={onAddFixedCategory}>
                  <Plus className="h-4 w-4 mr-2" /> Add Fixed Category
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add/Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>{editing && editing.id ? 'Edit Product' : 'Add Product'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editing && (
                <Button onClick={startAdd} className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" /> New Product
                </Button>
              )}
              {editing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="Category"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    options={[{ value: '', label: 'Select Category' }, ...getFixedCategories().map(v => ({ value: v, label: v }))]}
                  />
                  {(editing.category === 'night set' || editing.category === 'M. night set') && (
                    <Select
                      label="Sub Category"
                      value={editing.subCategory || ''}
                      onChange={(e) => setEditing({ ...editing, subCategory: e.target.value as SubCategory })}
                      options={[
                        { value: '', label: 'Select Sub Category' },
                        { value: 'top', label: 'top' },
                        { value: 'bottom', label: 'bottom' },
                      ]}
                    />
                  )}
                  <Input label="Style No" value={editing.styleNo || ''} onChange={(e) => setEditing({ ...editing, styleNo: e.target.value })} />
                  <Input label="All Colors (comma separated)" value={editing.allColors || ''} onChange={(e) => setEditing({ ...editing, allColors: e.target.value })} />
                  <Input label="All Sizes (comma separated)" value={editing.allSizes || ''} onChange={(e) => setEditing({ ...editing, allSizes: e.target.value })} />
                  <Input label="Name of Cut Parts" value={editing.cutParts || ''} onChange={(e) => setEditing({ ...editing, cutParts: e.target.value })} />
                  <Input type="number" label="Cut Cost" value={editing.cutCost ?? ''} onChange={(e) => setEditing({ ...editing, cutCost: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Input type="number" label="Print Cost" value={editing.printCost ?? ''} onChange={(e) => setEditing({ ...editing, printCost: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Input type="number" label="Stitch Cost" value={editing.stitchCost ?? ''} onChange={(e) => setEditing({ ...editing, stitchCost: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Input type="number" label="Iron Cost" value={editing.ironCost ?? ''} onChange={(e) => setEditing({ ...editing, ironCost: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              )}
              {editing && (
                <div className="flex space-x-2">
                  <Button onClick={handleSaveProduct} className="flex items-center">
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details ({products.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Sub Category</TableHead>
                    <TableHead>Style No</TableHead>
                    <TableHead>All Colors</TableHead>
                    <TableHead>All Sizes</TableHead>
                    <TableHead>Name of Cut Parts</TableHead>
                    <TableHead>Cut Cost</TableHead>
                    <TableHead>Print Cost</TableHead>
                    <TableHead>Stitch Cost</TableHead>
                    <TableHead>Iron Cost</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.category}</TableCell>
                      <TableCell>{p.subCategory || '-'}</TableCell>
                      <TableCell>{p.styleNo || '-'}</TableCell>
                      <TableCell>{p.allColors || '-'}</TableCell>
                      <TableCell>{p.allSizes || '-'}</TableCell>
                      <TableCell>{p.cutParts || '-'}</TableCell>
                      <TableCell>{p.cutCost ?? '-'}</TableCell>
                      <TableCell>{p.printCost ?? '-'}</TableCell>
                      <TableCell>{p.stitchCost ?? '-'}</TableCell>
                      <TableCell>{p.ironCost ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(p)} className="flex items-center">
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(p.id)} className="flex items-center">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell className="text-center text-gray-500 py-6">No products yet. Click New Product to add.</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell>&nbsp;</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'bills' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Bills Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              Monthly bills management coming soon...
              <br />
              Upload and manage fabric and accessory bills by month.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MasterData;