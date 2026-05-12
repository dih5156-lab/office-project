import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { getSocket } from '../../utils/socket';
import { useAuthStore } from '../../store/authStore';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface ToastItem {
  id: string;
  fromName: string;
  fromDept: string;
  content: string;
  room: string;
}

export default function MessageToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const location = useLocation();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handler = (msg: {
      id: string;
      fromId: string;
      fromName: string;
      fromDept: string;
      room: string;
      content: string;
    }) => {
      // 메신저 페이지에서는 알림 표시 안 함
      if (location.pathname === '/messenger') return;
      // 자기 자신 메시지는 제외
      if (msg.fromId === currentUser?.id) return;

      const toast: ToastItem = {
        id: msg.id ?? Math.random().toString(),
        fromName: msg.fromName,
        fromDept: msg.fromDept,
        room: msg.room,
        content: msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content,
      };
      setToasts((prev) => [toast, ...prev].slice(0, 3)); // 최대 3개

      // 4초 후 자동 제거
      setTimeout(() => dismiss(toast.id), 4000);
    };

    socket.on('receive_message', handler);
    return () => { socket.off('receive_message', handler); };
  }, [currentUser, dismiss, location.pathname]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'pointer-events-auto flex items-start gap-3 px-4 py-3 bg-gray-900 text-white rounded-2xl shadow-2xl',
            'w-72 animate-in slide-in-from-bottom-4 duration-200'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 text-sm font-bold">
            {toast.fromName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold truncate">{toast.fromName}</span>
              <span className="text-xs text-gray-400 shrink-0">{toast.fromDept}</span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed break-words">
              {toast.content.startsWith('[이미지]') ? '📷 이미지를 보냈습니다'
                : toast.content.startsWith('[파일]') ? '📎 파일을 보냈습니다'
                : toast.content}
            </p>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-gray-500 hover:text-white transition-colors shrink-0 mt-0.5"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
