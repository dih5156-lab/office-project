import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import AISummaryPage from './pages/AISummaryPage';
import DocumentsPage from './pages/DocumentsPage';
import LoginPage from './pages/LoginPage';
import UserManagePage from './pages/UserManagePage';
import MessengerPage from './pages/MessengerPage';
import NoticePage from './pages/NoticePage';
import ContactsPage from './pages/ContactsPage';
import TrashPage from './pages/TrashPage';
import ApprovalPage from './pages/ApprovalPage';
import { useAuthStore } from './store/authStore';
import { initNotificationSocket } from './store/notificationStore';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
