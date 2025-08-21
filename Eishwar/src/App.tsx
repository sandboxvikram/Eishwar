import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Layout Components
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import MasterData from './pages/MasterData';
import CuttingProgram from './pages/CuttingProgram';
import StitchingSection from './pages/StitchingSection';
import QualityControl from './pages/QualityControl';
import PaymentManagement from './pages/PaymentManagement';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/master-data" element={<MasterData />} />
              <Route path="/cutting" element={<CuttingProgram />} />
              <Route path="/stitching" element={<StitchingSection />} />
              <Route path="/qc" element={<QualityControl />} />
              <Route path="/payments" element={<PaymentManagement />} />
            </Routes>
          </Layout>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;