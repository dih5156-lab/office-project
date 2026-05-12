import { FileDown, Plus, Sheet } from 'lucide-react';

type Props = {
  onAdd: () => void;
  onExcel: () => void;
  onPdf: () => void;
};

export function DocumentToolbar({ onAdd, onExcel, onPdf }: Props) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-800">문서 관리</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={onExcel}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
          title="엑셀로 내보내기"
        >
          <Sheet size={14} /> 엑셀
        </button>
        <button
          onClick={onPdf}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
          title="PDF로 내보내기"
        >
          <FileDown size={14} /> PDF
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          문서 추가
        </button>
      </div>
    </div>
  );
}
