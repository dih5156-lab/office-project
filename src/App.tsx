import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import { useAuthStore } from './store/authStore';
import { initNotificationSocket } from './store/notificationStore';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const WeeklyReportPage = lazy(() => import('./pages/WeeklyReportPage'));
const AISummaryPage = lazy(() => import('./pages/AISummaryPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const UserManagePage = lazy(() => import('./pages/UserManagePage'));
const MessengerPage = lazy(() => import('./pages/MessengerPage'));
const NoticePage = lazy(() => import('./pages/NoticePage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const ApprovalPage = lazy(() => import('./pages/ApprovalPage'));

function LoadingView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 text-sm">로딩 중...</div>
    </div>
  );
}

export default function App() {
  const { currentUser, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (currentUser) {
      initNotificationSocket();
    }
  }, [currentUser]);

  // 안전장치: 3초 안에 초기화되지 않으면 강제로 로그인 페이지 표시
  useEffect(() => {
    if (isInitialized) return;
    const timer = setTimeout(() => {
      useAuthStore.setState({ isInitialized: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [isInitialized]);

  if (!isInitialized) {
    return <LoadingView />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingView />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="weekly-report" element={<WeeklyReportPage />} />
            <Route path="ai-summary" element={<AISummaryPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="notices" element={<NoticePage />} />
            <Route path="users" element={<UserManagePage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="messenger" element={<MessengerPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="approval" element={<ApprovalPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
