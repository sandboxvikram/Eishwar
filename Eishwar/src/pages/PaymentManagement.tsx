import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, CreditCard, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

import {
  calculatePayment, createPayment, getPayments, clearPayment,
  getPaymentDashboard, getUnitClearedDCs
} from '../services/paymentService';
import { getStitchingUnits } from '../services/stitchingService';

const PaymentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calculate');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [selectedDCs, setSelectedDCs] = useState<number[]>([]);

  const queryClient = useQueryClient();

  // Set default dates (current month)
  React.useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setFromDate(format(firstDay, 'yyyy-MM-dd'));
    setToDate(format(now, 'yyyy-MM-dd'));
  }, []);

  // Queries
  const { data: stitchingUnits = [] } = useQuery({
    queryKey: ['stitching-units'],
    queryFn: () => getStitchingUnits(true).then(res => res.data),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => getPayments().then(res => res.data),
  });

  const { data: paymentDashboard } = useQuery({
    queryKey: ['payment-dashboard'],
    queryFn: () => getPaymentDashboard().then(res => res.data),
  });

  const { data: clearedDCs = [] } = useQuery({
    queryKey: ['cleared-dcs', selectedUnit, fromDate, toDate],
    queryFn: () => getUnitClearedDCs(parseInt(selectedUnit), {
      from_date: fromDate,
      to_date: toDate
    }).then(res => res.data),
    enabled: !!selectedUnit && !!fromDate && !!toDate,
  });

  // Mutations
  const calculateMutation = useMutation({
    mutationFn: calculatePayment,
    onSuccess: (data) => {
      setCalculationResult(data.data);
      toast.success('Payment calculation completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Calculation failed');
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-dashboard'] });
      toast.success(`Payment created: ${data.data.payment_number}`);
      resetForm();
      setActiveTab('payments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create payment');
    },
  });

  const clearPaymentMutation = useMutation({
    mutationFn: ({ paymentId, clearedDate }: { paymentId: number; clearedDate?: string }) =>
      clearPayment(paymentId, clearedDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-dashboard'] });
      toast.success('Payment marked as cleared');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to clear payment');
    },
  });

  const resetForm = () => {
    setSelectedUnit('');
    setPaymentMethod('');
    setReferenceNumber('');
    setNotes('');
    setCreatedBy('');
    setCalculationResult(null);
    setSelectedDCs([]);
  };

  const handleCalculate = () => {
    if (!selectedUnit || !fromDate || !toDate) {
      toast.error('Please select unit and date range');
      return;
    }

    calculateMutation.mutate({
      stitching_unit_id: parseInt(selectedUnit),
      from_date: fromDate,
      to_date: toDate,
      dc_ids: selectedDCs.length > 0 ? selectedDCs : undefined,
    });
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!calculationResult || !paymentMethod || !createdBy) {
      toast.error('Please complete calculation and fill required fields');
      return;
    }

    const dcIds = selectedDCs.length > 0 ? selectedDCs : 
      calculationResult.dc_list.map((dc: any) => dc.dc_id);

    createPaymentMutation.mutate({
      stitching_unit_id: calculationResult.stitching_unit_id,
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      reference_number: referenceNumber || undefined,
      notes: notes || undefined,
      created_by: createdBy,
      dc_ids: dcIds,
      net_amount: calculationResult.net_amount,
    });
  };

  const handleDCSelection = (dcId: number, selected: boolean) => {
    setSelectedDCs(prev => 
      selected 
        ? [...prev, dcId]
        : prev.filter(id => id !== dcId)
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'cleared' ? 'success' : 'warning';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
          <p className="mt-2 text-gray-600">
            Calculate and process payments for stitching units
          </p>
        </div>

        {/* Dashboard Stats */}
        {paymentDashboard && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {paymentDashboard.this_month.total_payments}
              </div>
              <div className="text-sm text-gray-600">This Month</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                ₹{paymentDashboard.this_month.cleared_amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Cleared</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                ₹{paymentDashboard.this_month.pending_amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'calculate', label: 'Calculate Payment', icon: Calculator },
            { id: 'payments', label: 'Payment Records', icon: CreditCard },
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

      {activeTab === 'calculate' && (
        <div className="space-y-6">
          {/* Calculation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Calculation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Select
                  label="Stitching Unit *"
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  options={[
                    { value: '', label: 'Select Unit' },
                    ...stitchingUnits.map(unit => ({
                      value: unit.id.toString(),
                      label: `${unit.name} (₹${unit.rate_per_piece}/pc)`
                    }))
                  ]}
                  required
                />
                <Input
                  label="From Date *"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                />
                <Input
                  label="To Date *"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
                <div className="flex items-end">
                  <Button
                    onClick={handleCalculate}
                    loading={calculateMutation.isPending}
                    className="w-full"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate
                  </Button>
                </div>
              </div>

              {/* Available DCs for Selection */}
              {selectedUnit && clearedDCs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Available Cleared DCs ({clearedDCs.length})
                  </h3>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Select</TableHead>
                          <TableHead>DC Number</TableHead>
                          <TableHead>Return Date</TableHead>
                          <TableHead>Pieces</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clearedDCs.map((dc) => (
                          <TableRow key={dc.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedDCs.includes(dc.id)}
                                onChange={(e) => handleDCSelection(dc.id, e.target.checked)}
                                disabled={dc.already_paid}
                                className="rounded border-gray-300 text-blue-600"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="info">{dc.dc_number}</Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(dc.actual_return_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{dc.total_pieces_returned}</TableCell>
                            <TableCell>
                              {dc.already_paid ? (
                                <Badge variant="success">Paid</Badge>
                              ) : (
                                <Badge variant="warning">Unpaid</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calculation Results */}
          {calculationResult && (
            <Card>
              <CardHeader>
                <CardTitle>Calculation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {calculationResult.total_pieces}
                    </div>
                    <div className="text-sm text-blue-600">Total Pieces</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      ₹{calculationResult.gross_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-600">Gross Amount</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      ₹{calculationResult.suggested_deduction.toLocaleString()}
                    </div>
                    <div className="text-sm text-red-600">Deductions</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      ₹{calculationResult.net_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Net Amount</div>
                  </div>
                </div>

                {/* DC List */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Included DCs ({calculationResult.dc_list.length})
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DC Number</TableHead>
                        <TableHead>OK Pieces</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculationResult.dc_list.map((dc: any) => (
                        <TableRow key={dc.dc_id}>
                          <TableCell>
                            <Badge variant="info">{dc.dc_number}</Badge>
                          </TableCell>
                          <TableCell>{dc.total_ok_pieces}</TableCell>
                          <TableCell>₹{dc.rate_per_piece}</TableCell>
                          <TableCell className="font-medium">
                            ₹{dc.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Payment Form */}
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Payment Method *"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      options={[
                        { value: '', label: 'Select Method' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'cheque', label: 'Cheque' },
                        { value: 'upi', label: 'UPI' },
                      ]}
                      required
                    />
                    <Input
                      label="Reference Number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Transaction/Cheque number"
                    />
                    <Input
                      label="Created By *"
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <Input
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional payment notes"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      loading={createPaymentMutation.isPending}
                      className="px-8"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Create Payment
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Records ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Number</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Badge variant="info">{payment.payment_number}</Badge>
                    </TableCell>
                    <TableCell>Unit {payment.stitching_unit_id}</TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{payment.total_pieces}</TableCell>
                    <TableCell className="font-medium">
                      ₹{payment.net_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge>{payment.payment_method}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(payment.status)}>
                        {payment.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => clearPaymentMutation.mutate({ 
                            paymentId: payment.id,
                            clearedDate: new Date().toISOString()
                          })}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {payments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No payment records found. Create your first payment to get started.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentManagement;