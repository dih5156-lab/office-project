import {
  ChevronDown,
  Edit3,
  FileDown,
  FileSpreadsheet,
  FileType,
  Paperclip,
  Upload,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { Document, UploadedFile } from '../../types';
import { fixMojibake } from '../../utils/encoding';
import { DOCUMENT_CATEGORY_COLORS } from '../../features/documents/constants';
import { DocumentFileRow } from './DocumentFileRow';

type Props = {
  document: Document;
  files: UploadedFile[];
  exportMenuOpen: boolean;
  onExportMenuChange: (open: boolean) => void;
  onClose: () => void;
  onEdit: (document: Document) => void;
  onExportPdf: (document: Document) => void;
  onExportWord: (document: Document) => Promise<void>;
  onExportExcel: (document: Document) => void;
  onAttachFiles: (document: Document, files: File[]) => Promise<void>;
  onDownloadFile: (file: UploadedFile) => void;
  onDeleteFile: (file: UploadedFile) => void;
};

export function DocumentViewModal({
  document,
  files,
  exportMenuOpen,
  onExportMenuChange,
  onClose,
  onEdit,
  onExportPdf,
  onExportWord,
  onExportExcel,
  onAttachFiles,
  onDownloadFile,
  onDeleteFile,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">{fixMojibake(document.title)}</h3>
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                DOCUMENT_CATEGORY_COLORS[document.category]
              )}
            >
              {document.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ExportMenu
              document={document}
              open={exportMenuOpen}
              onOpenChange={onExportMenuChange}
              onExportPdf={onExportPdf}
              onExportWord={onExportWord}
              onExportExcel={onExportExcel}
            />
            <button
              onClick={() => onEdit(document)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
            >
              <Edit3 size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {document.content}
          </pre>
          <DocumentTagList tags={document.tags} />
          <AttachmentSection
            document={document}
            files={files}
            onAttachFiles={onAttachFiles}
            onDownloadFile={onDownloadFile}
            onDeleteFile={onDeleteFile}
          />
        </div>
      </div>
    </div>
  );
}

type ExportMenuProps = {
  document: Document;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportPdf: (document: Document) => void;
  onExportWord: (document: Document) => Promise<void>;
  onExportExcel: (document: Document) => void;
};

function ExportMenu({
  document,
  open,
  onOpenChange,
  onExportPdf,
  onExportWord,
  onExportExcel,
}: ExportMenuProps) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
      >
        <FileDown size={13} /> 내보내기 <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[150px]">
            <button
              onClick={() => {
                onExportPdf(document);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <FileDown size={14} className="text-red-500" /> PDF 인쇄/저장
            </button>
            <button
              onClick={async () => {
                await onExportWord(document);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <FileType size={14} className="text-blue-500" /> Word (.docx)
            </button>
            <button
              onClick={() => {
                onExportExcel(document);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-green-500" /> Excel CSV (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
      {tags.map((tag) => (
        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          #{tag}
        </span>
      ))}
    </div>
  );
}

type AttachmentProps = {
  document: Document;
  files: UploadedFile[];
  onAttachFiles: (document: Document, files: File[]) => Promise<void>;
  onDownloadFile: (file: UploadedFile) => void;
  onDeleteFile: (file: UploadedFile) => void;
};

function AttachmentSection({
  document,
  files,
  onAttachFiles,
  onDownloadFile,
  onDeleteFile,
}: AttachmentProps) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Paperclip size={14} /> 첨부 파일 ({files.length})
        </p>
        <label className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
          <Upload size={12} /> 파일 추가
          <input
            type="file"
            multiple
            className="hidden"
            onChange={async (event) => {
              const selected = Array.from(event.target.files || []);
              if (selected.length > 0) await onAttachFiles(document, selected);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">첨부된 파일이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <DocumentFileRow
              key={file.id}
              file={file}
              onDownload={() => onDownloadFile(file)}
              onDelete={() => onDeleteFile(file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
