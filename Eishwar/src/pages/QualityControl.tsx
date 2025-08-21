import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Search, AlertTriangle, CheckCircle, X, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

import {
  getDCsForQC, processQRScan, getQCSummary, getPendingDCs,
  createStitchReturn, manualStatusUpdate
} from '../services/qcService';
import { getStitchingUnits } from '../services/stitchingService';

const QualityControl: React.FC = () => {
  const [activeTab, setActiveTab] = useState('scan');
  const [scanInput, setScanInput] = useState('');
  const [scannerName, setScannerName] = useState('');
  const [scanType, setScanType] = useState<'outbound' | 'inbound'>('inbound');
  const [scannedQuantity, setScannedQuantity] = useState('');
  const [scanNotes, setScanNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const queryClient = useQueryClient();

  // Queries
  const { data: dcsForQC = [] } = useQuery({
    queryKey: ['dcs-for-qc', selectedStatus, selectedUnit],
    queryFn: () => getDCsForQC({ 
      status: selectedStatus || undefined,
      unit_id: selectedUnit ? parseInt(selectedUnit) : undefined
    }).then(res => res.data),
  });

  const { data: qcSummary } = useQuery({
    queryKey: ['qc-summary'],
    queryFn: () => getQCSummary().then(res => res.data),
  });

  const { data: pendingDCs = [] } = useQuery({
    queryKey: ['pending-dcs'],
    queryFn: () => getPendingDCs().then(res => res.data),
  });

  const { data: stitchingUnits = [] } = useQuery({
    queryKey: ['stitching-units'],
    queryFn: () => getStitchingUnits().then(res => res.data),
  });

  // Mutations
  const scanMutation = useMutation({
    mutationFn: processQRScan,
    onSuccess: (data) => {
      const result = data.data;
      if (result.success) {
        if (result.is_match) {
          toast.success(`QR Scan successful! Status: ${result.new_status}`);
        } else {
          toast.error(`Quantity mismatch! Expected: ${result.expected_quantity}, Scanned: ${result.scanned_quantity}`);
        }
      } else {
        toast.error(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ['dcs-for-qc'] });
      queryClient.invalidateQueries({ queryKey: ['qc-summary'] });
      resetScanForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'QR scan failed');
    },
  });

  const statusUpdateMutation = useMutation({
    mutationFn: ({ dcId, status, reason }: { dcId: number; status: string; reason: string }) =>
      manualStatusUpdate(dcId, status, reason),
    onSuccess: () => {
      toast.success('DC status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['dcs-for-qc'] });
      queryClient.invalidateQueries({ queryKey: ['pending-dcs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    },
  });

  const resetScanForm = () => {
    setScanInput('');
    setScannedQuantity('');
    setScanNotes('');
  };

  const handleQRScan = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!scanInput || !scannerName || !scannedQuantity) {
      toast.error('Please fill all required fields');
      return;
    }

    scanMutation.mutate({
      qr_code_data: scanInput,
      scanner_name: scannerName,
      scan_type: scanType,
      scanned_quantity: parseInt(scannedQuantity),
      notes: scanNotes || undefined,
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

  const handleStatusUpdate = (dcId: number, newStatus: string) => {
    const reason = prompt('Please enter reason for status change:');
    if (reason) {
      statusUpdateMutation.mutate({ dcId, status: newStatus, reason });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
          <p className="mt-2 text-gray-600">
            Scan QR codes and manage quality control for delivery challans
          </p>
        </div>

        {/* QC Stats */}
        {qcSummary && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {qcSummary.today_scans}
              </div>
              <div className="text-sm text-gray-600">Today Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {qcSummary.scan_accuracy.accuracy_rate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {qcSummary.returns.reject_rate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Reject Rate</div>
            </div>
          </div>
        
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'scan', label: 'QR Scanner', icon: Camera },
            { id: 'dcs', label: 'DC Management', icon: Search },
            { id: 'pending', label: 'Pending DCs', icon: AlertTriangle },
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

      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                QR Code Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQRScan} className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    label="QR Code Data *"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan or enter QR code data"
                    className="flex-1"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCamera(!showCamera)}
                    className="mt-6"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Scanner Name *"
                    value={scannerName}
                    onChange={(e) => setScannerName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                  <Select
                    label="Scan Type *"
                    value={scanType}
                    onChange={(e) => setScanType(e.target.value as 'outbound' | 'inbound')}
                    options={[
                      { value: 'outbound', label: 'Outbound (Dispatch)' },
                      { value: 'inbound', label: 'Inbound (Return)' },
                    ]}
                    required
                  />
                </div>

                <Input
                  label="Scanned Quantity *"
                  type="number"
                  value={scannedQuantity}
                  onChange={(e) => setScannedQuantity(e.target.value)}
                  placeholder="Number of pieces scanned"
                  min="1"
                  required
                />

                <Input
                  label="Notes"
                  value={scanNotes}
                  onChange={(e) => setScanNotes(e.target.value)}
                  placeholder="Optional notes about the scan"
                />

                <Button
                  type="submit"
                  loading={scanMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Process QR Scan
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Scan Results */}
          <Card>
            <CardHeader>
              <CardTitle>Scan Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Outbound Scan</h4>
                <p className="text-sm text-blue-800">
                  Scan when DC is being dispatched to stitching unit. 
                  Verifies the quantity being sent matches the DC.
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Inbound Scan</h4>
                <p className="text-sm text-green-800">
                  Scan when DC returns from stitching unit. 
                  Verifies the quantity returned and updates DC status.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">Quantity Mismatch</h4>
                <p className="text-sm text-yellow-800">
                  If scanned quantity doesn't match expected, DC will be put on hold 
                  for manual review and correction.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'dcs' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter DCs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'open', label: 'Open' },
                    { value: 'partial', label: 'Partial' },
                    { value: 'hold', label: 'Hold' },
                    { value: 'cleared', label: 'Cleared' },
                  ]}
                />
                <Select
                  label="Stitching Unit"
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  options={[
                    { value: '', label: 'All Units' },
                    ...stitchingUnits.map(unit => ({
                      value: unit.id.toString(),
                      label: unit.name
                    }))
                  ]}
                />
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      setSelectedStatus('');
                      setSelectedUnit('');
                    }}
                    variant="secondary"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DCs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Challans ({dcsForQC.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DC Number</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>DC Date</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dcsForQC.map((dc) => (
                    <TableRow key={dc.id}>
                      <TableCell>
                        <Badge variant="info">{dc.dc_number}</Badge>
                      </TableCell>
                      <TableCell>{dc.stitching_unit?.name || 'Unknown'}</TableCell>
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
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // View DC details
                              console.log('View DC:', dc.id);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {dc.status === 'hold' && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleStatusUpdate(dc.id, 'cleared')}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {dcsForQC.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No delivery challans found with the selected filters.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Pending DCs Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DC Number</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Days Pending</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Hold Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDCs.map((dc) => (
                  <TableRow key={dc.id}>
                    <TableCell>
                      <Badge variant="info">{dc.dc_number}</Badge>
                    </TableCell>
                    <TableCell>{dc.unit_name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(dc.status)}>
                        {dc.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dc.days_pending > 7 ? 'danger' : 'warning'}>
                        {dc.days_pending} days
                      </Badge>
                    </TableCell>
                    <TableCell>{dc.total_pieces_sent}</TableCell>
                    <TableCell>{dc.total_pieces_returned}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {dc.hold_reason || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleStatusUpdate(dc.id, 'cleared')}
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            // View details
                            console.log('View DC details:', dc.id);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pendingDCs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                No pending DCs! All delivery challans are up to date.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualityControl;