import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Scissors, Shirt, CheckCircle, CreditCard, 
  TrendingUp, AlertTriangle, Clock, DollarSign 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getCuttingSummary } from '../services/cuttingService';
import { getStitchingDashboard } from '../services/stitchingService';
import { getQCSummary } from '../services/qcService';
import { getPaymentDashboard } from '../services/paymentService';

const Dashboard: React.FC = () => {
  const { data: cuttingData } = useQuery({
    queryKey: ['cutting-summary'],
    queryFn: () => getCuttingSummary().then(res => res.data),
  });

  const { data: stitchingData } = useQuery({
    queryKey: ['stitching-dashboard'],
    queryFn: () => getStitchingDashboard().then(res => res.data),
  });

  const { data: qcData } = useQuery({
    queryKey: ['qc-summary'],
    queryFn: () => getQCSummary().then(res => res.data),
  });

  const { data: paymentData } = useQuery({
    queryKey: ['payment-dashboard'],
    queryFn: () => getPaymentDashboard().then(res => res.data),
  });

  const statsCards = [
    {
      title: 'Active Lots',
      value: cuttingData?.total_lots || 0,
      icon: Scissors,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Open DCs',
      value: stitchingData?.dc_status?.open || 0,
      icon: Shirt,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Today Scans',
      value: qcData?.today_scans || 0,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Pending Amount',
      value: `₹${(paymentData?.this_month?.pending_amount || 0).toLocaleString()}`,
      icon: CreditCard,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manufacturing Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of your apparel manufacturing workflow
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cutting Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Scissors className="h-5 w-5 mr-2 text-blue-600" />
              Cutting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Created Bundles</span>
                <Badge variant="info">
                  {cuttingData?.bundle_status?.created || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dispatched Bundles</span>
                <Badge variant="warning">
                  {cuttingData?.bundle_status?.dispatched || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Returned Bundles</span>
                <Badge variant="success">
                  {cuttingData?.bundle_status?.returned || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DC Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shirt className="h-5 w-5 mr-2 text-green-600" />
              Delivery Challan Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Open</span>
                <Badge variant="info">
                  {stitchingData?.dc_status?.open || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Partial</span>
                <Badge variant="warning">
                  {stitchingData?.dc_status?.partial || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Hold</span>
                <Badge variant="danger">
                  {stitchingData?.dc_status?.hold || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cleared</span>
                <Badge variant="success">
                  {stitchingData?.dc_status?.cleared || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QC Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-purple-600" />
              QC Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Scan Accuracy</span>
                <Badge variant={qcData?.scan_accuracy?.accuracy_rate > 95 ? 'success' : 'warning'}>
                  {qcData?.scan_accuracy?.accuracy_rate?.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Reject Rate</span>
                <Badge variant={qcData?.returns?.reject_rate < 5 ? 'success' : 'danger'}>
                  {qcData?.returns?.reject_rate?.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">OK Returns</span>
                <span className="text-sm font-medium text-gray-900">
                  {qcData?.returns?.ok || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-orange-600" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Month Payments</span>
                <span className="text-sm font-medium text-gray-900">
                  {paymentData?.this_month?.total_payments || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-sm font-medium text-gray-900">
                  ₹{(paymentData?.this_month?.total_amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cleared</span>
                <Badge variant="success">
                  ₹{(paymentData?.this_month?.cleared_amount || 0).toLocaleString()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors">
              <Scissors className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-blue-900">New Cutting</span>
            </button>
            <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors">
              <Shirt className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-green-900">Create DC</span>
            </button>
            <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition-colors">
              <CheckCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-purple-900">QC Scan</span>
            </button>
            <button className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition-colors">
              <CreditCard className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-orange-900">Process Payment</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;