import { Download, X } from 'lucide-react';
import { UploadedFile } from '../../types';
import { fileColor, fileExt, formatFileSize } from '../../store/fileStore';

type Props = {
  file: UploadedFile;
  onDownload: () => void;
  onDelete: () => void;
};

export function DocumentFileRow({ file, onDownload, onDelete }: Props) {
  const ext = fileExt(file.originalName);
  const color = fileColor(file.mimeType);

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
        style={{ background: color }}
      >
        {ext.slice(0, 4)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{file.originalName}</p>
        <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onDownload}
          className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
          title="다운로드"
        >
          <Download size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors"
          title="삭제"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
