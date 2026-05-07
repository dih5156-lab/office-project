import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/schedule': '일정 관리',
  '/weekly-report': '주간 업무 보고',
  '/ai-summary': 'AI 내용 요약',
  '/documents': '문서 관리',
};

export default function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || '오피스 자동화';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
