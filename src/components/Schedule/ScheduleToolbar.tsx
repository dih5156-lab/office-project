import { Calendar, FileDown, List, Plus, Sheet } from 'lucide-react';
import clsx from 'clsx';
import { ScheduleViewMode } from '../../features/schedule/types';

type Props = {
  viewMode: ScheduleViewMode;
  onViewModeChange: (mode: ScheduleViewMode) => void;
  onAdd: () => void;
  onExcel: () => void;
  onPdf: () => void;
};

export function ScheduleToolbar({
  viewMode,
  onViewModeChange,
  onAdd,
  onExcel,
  onPdf,
}: Props) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-800">일정 관리</h2>
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('calendar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'calendar'
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Calendar size={13} /> 달력
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <List size={13} /> 목록
          </button>
        </div>
        <button
          onClick={onExcel}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
        >
          <Sheet size={14} /> 엑셀
        </button>
        <button
          onClick={onPdf}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
        >
          <FileDown size={14} /> PDF
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> 일정 추가
        </button>
      </div>
    </div>
  );
}
