import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { Navbar } from './components/Layout/Navbar';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { CreateProduct } from './components/Products/CreateProduct';
import { TransactionModal } from './components/Transactions/TransactionModal';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [transactionData, setTransactionData] = useState<{
    productId: string;
    sellerId: string;
    amount: number;
  } | null>(null);

  const navigate = useNavigate();

  const handleInitiateTransaction = (productId: string, sellerId: string, amount: number) => {
    setTransactionData({ productId, sellerId, amount });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        {authMode === 'login' ? (
          <Login onSwitchToSignup={() => setAuthMode('signup')} />
        ) : (
          <Signup onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar
      currentPage={window.location.pathname.replace('/', '') || 'home'}
        onNavigate={(page) => {
          if (page === 'create') setShowCreateProduct(true);
          else navigate(page === 'home' ? '/' : `/${page}`);
        }}
      />

      <Routes>
        <Route path="/" element={<HomePage onInitiateTransaction={handleInitiateTransaction} />} />
        <Route
        path="/chats"
        element={<ChatPage onInitiateTransaction={handleInitiateTransaction} />}
        />
        <Route path="/chat/:chatId" element={<ChatPage onInitiateTransaction={handleInitiateTransaction} />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>

      {showCreateProduct && (
        <CreateProduct
          onClose={() => setShowCreateProduct(false)}
          onSuccess={() => setShowCreateProduct(false)}
        />
      )}

      {transactionData && (
        <TransactionModal
          productId={transactionData.productId}
          sellerId={transactionData.sellerId}
          amount={transactionData.amount}
          onClose={() => setTransactionData(null)}
          onSuccess={() => {
            setTransactionData(null);
            alert('Transaction created successfully!');
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
