import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shirt, QrCode, Search, Edit, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

import {
  getStitchingUnits, createStitchingUnit, createDeliveryChallan,
  getDeliveryChallans, getStitchingDashboard
} from '../services/stitchingService';
import { getCuttingLots, getLotBundles } from '../services/cuttingService';

const StitchingSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState('units');
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [showCreateDC, setShowCreateDC] = useState(false);
  const [selectedLot, setSelectedLot] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const queryClient = useQueryClient();

  // New Unit Form State
  const [newUnit, setNewUnit] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    capacity_per_day: '',
    rate_per_piece: '',
  });

  // New DC Form State
  const [newDC, setNewDC] = useState({
    stitching_unit_id: '',
    cutting_lot_id: '',
    expected_return_date: '',
    notes: '',
  });
  const [selectedBundles, setSelectedBundles] = useState<Array<{ bundle_id: number; quantity_sent: number }>>([]);

  // Queries
  const { data: stitchingUnits = [] } = useQuery({
    queryKey: ['stitching-units'],
    queryFn: () => getStitchingUnits(true).then(res => res.data),
  });

  const { data: cuttingLots = [] } = useQuery({
    queryKey: ['cutting-lots'],
    queryFn: () => getCuttingLots().then(res => res.data),
  });

  const { data: lotBundles = [] } = useQuery({
    queryKey: ['lot-bundles', selectedLot],
    queryFn: () => getLotBundles(parseInt(selectedLot)).then(res => res.data),
    enabled: !!selectedLot,
  });

  const { data: deliveryChallans = [] } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: () => getDeliveryChallans().then(res => res.data),
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['stitching-dashboard'],
    queryFn: () => getStitchingDashboard().then(res => res.data),
  });

  // Mutations
  const createUnitMutation = useMutation({
    mutationFn: createStitchingUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stitching-units'] });
      setShowCreateUnit(false);
      setNewUnit({
        name: '', contact_person: '', phone: '', email: '', address: '',
        capacity_per_day: '', rate_per_piece: ''
      });
      toast.success('Stitching unit created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create stitching unit');
    },
  });

  const createDCMutation = useMutation({
    mutationFn: createDeliveryChallan,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      setShowCreateDC(false);
      resetDCForm();
      toast.success(`DC created: ${data.data.dc_number}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create delivery challan');
    },
  });

  const resetDCForm = () => {
    setNewDC({
      stitching_unit_id: '',
      cutting_lot_id: '',
      expected_return_date: '',
      notes: '',
    });
    setSelectedLot('');
    setSelectedBundles([]);
  };

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnit.name || !newUnit.contact_person || !newUnit.phone || !newUnit.address || 
        !newUnit.capacity_per_day || !newUnit.rate_per_piece) {
      toast.error('Please fill all required fields');
      return;
    }

    createUnitMutation.mutate({
      ...newUnit,
      capacity_per_day: parseInt(newUnit.capacity_per_day),
      rate_per_piece: parseFloat(newUnit.rate_per_piece),
      is_active: true,
    });
  };

  const handleCreateDC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDC.stitching_unit_id || !newDC.cutting_lot_id || selectedBundles.length === 0) {
      toast.error('Please fill all required fields and select bundles');
      return;
    }

    createDCMutation.mutate({
      stitching_unit_id: parseInt(newDC.stitching_unit_id),
      cutting_lot_id: parseInt(newDC.cutting_lot_id),
      expected_return_date: newDC.expected_return_date || undefined,
      notes: newDC.notes || undefined,
      dc_items: selectedBundles,
    });
  };

  const handleBundleSelection = (bundleId: number, selected: boolean, quantity?: number) => {
    setSelectedBundles(prev => {
      if (selected && quantity && quantity > 0) {
        const existing = prev.find(b => b.bundle_id === bundleId);
        if (existing) {
          return prev.map(b => 
            b.bundle_id === bundleId ? { ...b, quantity_sent: quantity } : b
          );
        }
        return [...prev, { bundle_id: bundleId, quantity_sent: quantity }];
      } else {
        return prev.filter(b => b.bundle_id !== bundleId);
      }
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open': return 'info';
      case 'partial': return 'warning';
      case 'hold': return 'danger';
      case 'cleared': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stitching Section</h1>
          <p className="mt-2 text-gray-600">
            Manage stitching units and delivery challans with QR code tracking
          </p>
        </div>
        
        {/* Dashboard Stats */}
        <div className="flex space-x-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData?.active_units || 0}
            </div>
            <div className="text-sm text-gray-600">Active Units</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {dashboardData?.dc_status?.open || 0}
            </div>
            <div className="text-sm text-gray-600">Open DCs</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'units', label: 'Stitching Units', icon: Shirt },
            { id: 'dcs', label: 'Delivery Challans', icon: QrCode },
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

      {activeTab === 'units' && (
        <div className="space-y-6">
          {/* Units Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Stitching Units ({stitchingUnits.length})
            </h2>
            <Button onClick={() => setShowCreateUnit(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Unit
            </Button>
          </div>

          {/* Create Unit Form */}
          {showCreateUnit && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Stitching Unit</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUnit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Unit Name *"
                      value={newUnit.name}
                      onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                      placeholder="e.g., ABC Garments"
                      required
                    />
                    <Input
                      label="Contact Person *"
                      value={newUnit.contact_person}
                      onChange={(e) => setNewUnit({ ...newUnit, contact_person: e.target.value })}
                      placeholder="Contact person name"
                      required
                    />
                    <Input
                      label="Phone *"
                      value={newUnit.phone}
                      onChange={(e) => setNewUnit({ ...newUnit, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={newUnit.email}
                      onChange={(e) => setNewUnit({ ...newUnit, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                    <Input
                      label="Capacity per Day *"
                      type="number"
                      value={newUnit.capacity_per_day}
                      onChange={(e) => setNewUnit({ ...newUnit, capacity_per_day: e.target.value })}
                      placeholder="100"
                      min="1"
                      required
                    />
                    <Input
                      label="Rate per Piece *"
                      type="number"
                      step="0.01"
                      value={newUnit.rate_per_piece}
                      onChange={(e) => setNewUnit({ ...newUnit, rate_per_piece: e.target.value })}
                      placeholder="25.00"
                      min="0.01"
                      required
                    />
                  </div>
                  <Input
                    label="Address *"
                    value={newUnit.address}
                    onChange={(e) => setNewUnit({ ...newUnit, address: e.target.value })}
                    placeholder="Complete address"
                    required
                  />
                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowCreateUnit(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={createUnitMutation.isPending}>
                      Create Unit
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Units Table */}
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Capacity/Day</TableHead>
                    <TableHead>Rate/Piece</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stitchingUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>{unit.contact_person}</TableCell>
                      <TableCell>{unit.phone}</TableCell>
                      <TableCell>{unit.capacity_per_day}</TableCell>
                      <TableCell>₹{unit.rate_per_piece}</TableCell>
                      <TableCell>
                        <Badge variant={unit.is_active ? 'success' : 'danger'}>
                          {unit.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="secondary">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="secondary">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'dcs' && (
        <div className="space-y-6">
          {/* DCs Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Delivery Challans ({deliveryChallans.length})
            </h2>
            <Button onClick={() => setShowCreateDC(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New DC
            </Button>
          </div>

          {/* Create DC Form */}
          {showCreateDC && (
            <Card>
              <CardHeader>
                <CardTitle>Create Delivery Challan</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDC} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Stitching Unit *"
                      value={newDC.stitching_unit_id}
                      onChange={(e) => setNewDC({ ...newDC, stitching_unit_id: e.target.value })}
                      options={[
                        { value: '', label: 'Select Stitching Unit' },
                        ...stitchingUnits.map(unit => ({
                          value: unit.id.toString(),
                          label: `${unit.name} (₹${unit.rate_per_piece}/pc)`
                        }))
                      ]}
                      required
                    />
                    <Select
                      label="Cutting Lot *"
                      value={selectedLot}
                      onChange={(e) => {
                        setSelectedLot(e.target.value);
                        setNewDC({ ...newDC, cutting_lot_id: e.target.value });
                      }}
                      options={[
                        { value: '', label: 'Select Cutting Lot' },
                        ...cuttingLots.map(lot => ({
                          value: lot.id.toString(),
                          label: `${lot.lot_number} (${lot.total_pieces} pcs)`
                        }))
                      ]}
                      required
                    />
                    <Input
                      label="Expected Return Date"
                      type="date"
                      value={newDC.expected_return_date}
                      onChange={(e) => setNewDC({ ...newDC, expected_return_date: e.target.value })}
                    />
                  </div>

                  {/* Bundle Selection */}
                  {selectedLot && lotBundles.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Select Bundles ({lotBundles.length} available)
                      </h3>
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Select</TableHead>
                              <TableHead>Bundle Number</TableHead>
                              <TableHead>Panel Type</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Send Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lotBundles.filter(bundle => bundle.status === 'created').map((bundle) => (
                              <TableRow key={bundle.id}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        handleBundleSelection(bundle.id, true, bundle.quantity);
                                      } else {
                                        handleBundleSelection(bundle.id, false);
                                      }
                                    }}
                                    className="rounded border-gray-300 text-blue-600"
                                  />
                                </TableCell>
                                <TableCell>{bundle.bundle_number}</TableCell>
                                <TableCell>
                                  <Badge>{bundle.panel_type}</Badge>
                                </TableCell>
                                <TableCell>{bundle.quantity}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={bundle.quantity}
                                    defaultValue={bundle.quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value);
                                      if (qty > 0) {
                                        handleBundleSelection(bundle.id, true, qty);
                                      }
                                    }}
                                    className="w-20"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {selectedBundles.length > 0 && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900">Selected Bundles:</h4>
                          <div className="mt-2 text-sm text-blue-800">
                            {selectedBundles.length} bundles, {selectedBundles.reduce((sum, b) => sum + b.quantity_sent, 0)} total pieces
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Input
                    label="Notes"
                    value={newDC.notes}
                    onChange={(e) => setNewDC({ ...newDC, notes: e.target.value })}
                    placeholder="Optional notes"
                  />

                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowCreateDC(false);
                        resetDCForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={createDCMutation.isPending}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Create DC
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* DCs Table */}
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DC Number</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>DC Date</TableHead>
                    <TableHead>Total Sent</TableHead>
                    <TableHead>Total Returned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryChallans.map((dc) => (
                    <TableRow key={dc.id}>
                      <TableCell>
                        <Badge variant="info">{dc.dc_number}</Badge>
                      </TableCell>
                      <TableCell>Unit {dc.stitching_unit_id}</TableCell>
                      <TableCell>{new Date(dc.dc_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{dc.total_pieces_sent}</TableCell>
                      <TableCell className="font-medium">{dc.total_pieces_returned}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(dc.status)}>
                          {dc.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="secondary">
                            <QrCode className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="secondary">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StitchingSection;