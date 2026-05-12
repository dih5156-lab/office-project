import { RefObject } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Document, DocumentCategory } from '../../types';
import { DOCUMENT_CATEGORIES } from '../../features/documents/constants';
import { DocumentForm } from '../../features/documents/types';
import { formatFileSize } from '../../store/fileStore';

type Props = {
  editTarget: Document | null;
  form: DocumentForm;
  tagInput: string;
  pendingFiles: File[];
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onFormChange: (form: DocumentForm) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function DocumentEditModal({
  editTarget,
  form,
  tagInput,
  pendingFiles,
  isUploading,
  fileInputRef,
  onFormChange,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onFileSelect,
  onRemovePendingFile,
  onClose,
  onSubmit,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            {editTarget ? '문서 수정' : '문서 추가'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <TitleField form={form} onFormChange={onFormChange} />
          <CategoryField form={form} onFormChange={onFormChange} />
          <ContentField form={form} onFormChange={onFormChange} />
          <TagField
            form={form}
            tagInput={tagInput}
            onTagInputChange={onTagInputChange}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
          <PendingFileField
            fileInputRef={fileInputRef}
            pendingFiles={pendingFiles}
            onFileSelect={onFileSelect}
            onRemovePendingFile={onRemovePendingFile}
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!form.title.trim() || isUploading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading && <Loader2 size={14} className="animate-spin" />}
            {editTarget ? '수정 완료' : '문서 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

type FormFieldProps = {
  form: DocumentForm;
  onFormChange: (form: DocumentForm) => void;
};

function TitleField({ form, onFormChange }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
      <input
        type="text"
        value={form.title}
        onChange={(event) => onFormChange({ ...form, title: event.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="문서 제목"
      />
    </div>
  );
}

function CategoryField({ form, onFormChange }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
      <select
        value={form.category}
        onChange={(event) => onFormChange({
          ...form,
          category: event.target.value as DocumentCategory,
        })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {DOCUMENT_CATEGORIES.map((category) => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>
    </div>
  );
}

function ContentField({ form, onFormChange }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
      <textarea
        value={form.content}
        onChange={(event) => onFormChange({ ...form, content: event.target.value })}
        rows={6}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="문서 내용을 입력하세요"
      />
    </div>
  );
}

type TagFieldProps = {
  form: DocumentForm;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
};

function TagField({
  form,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: TagFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={tagInput}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onAddTag()}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="태그 입력 후 Enter"
        />
        <button
          type="button"
          onClick={onAddTag}
          className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
        >
          추가
        </button>
      </div>
      {form.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {form.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
            >
              #{tag}
              <button onClick={() => onRemoveTag(tag)}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type PendingFileFieldProps = {
  fileInputRef: RefObject<HTMLInputElement>;
  pendingFiles: File[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (index: number) => void;
};

function PendingFileField({
  fileInputRef,
  pendingFiles,
  onFileSelect,
  onRemovePendingFile,
}: PendingFileFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">파일 첨부</label>
      <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-lg py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors text-sm text-gray-500 hover:text-blue-600">
        <Upload size={15} />
        파일 선택 (최대 5개, 20MB)
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileSelect}
        />
      </label>
      {pendingFiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-xs"
            >
              <span className="text-gray-700 truncate max-w-[250px]">{file.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400">{formatFileSize(file.size)}</span>
                <button
                  onClick={() => onRemovePendingFile(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
