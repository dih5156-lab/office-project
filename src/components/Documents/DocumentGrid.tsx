import { Check, Edit3, FileText, FolderOpen, Tag, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Document } from '../../types';
import { DOCUMENT_CATEGORY_COLORS } from '../../features/documents/constants';

type Props = {
  documents: Document[];
  query: string;
  deleteConfirm: string | null;
  onView: (document: Document) => void;
  onEdit: (document: Document) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

export function DocumentGrid({
  documents,
  query,
  deleteConfirm,
  onView,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: Props) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
        <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
        <p>{query ? '검색 결과가 없습니다' : '문서가 없습니다'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          isConfirmingDelete={deleteConfirm === document.id}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onDeleteConfirmChange={onDeleteConfirmChange}
        />
      ))}
    </div>
  );
}

type CardProps = {
  document: Document;
  isConfirmingDelete: boolean;
  onView: (document: Document) => void;
  onEdit: (document: Document) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

function DocumentCard({
  document,
  isConfirmingDelete,
  onView,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <button onClick={() => onView(document)} className="flex-1 text-left w-full">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-gray-400 shrink-0" />
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{document.title}</p>
          </div>
          <span
            className={clsx(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              DOCUMENT_CATEGORY_COLORS[document.category]
            )}
          >
            {document.category}
          </span>
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {document.content}
          </p>
        </button>
        <DocumentTags tags={document.tags} />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <p className="text-xs text-gray-400">
            {format(new Date(document.updatedAt), 'yyyy/MM/dd', { locale: ko })}
          </p>
          <DocumentCardActions
            document={document}
            isConfirmingDelete={isConfirmingDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteConfirmChange={onDeleteConfirmChange}
          />
        </div>
      </div>
    </div>
  );
}

function DocumentTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {tags.map((tag) => (
        <span key={tag} className="text-xs text-gray-500 flex items-center gap-0.5">
          <Tag size={9} />
          {tag}
        </span>
      ))}
    </div>
  );
}

type ActionProps = {
  document: Document;
  isConfirmingDelete: boolean;
  onEdit: (document: Document) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

function DocumentCardActions({
  document,
  isConfirmingDelete,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: ActionProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onEdit(document)}
        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
      >
        <Edit3 size={13} />
      </button>
      {isConfirmingDelete ? (
        <>
          <button
            onClick={() => onDelete(document.id)}
            className="p-1 bg-red-100 rounded text-red-500"
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => onDeleteConfirmChange(null)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <button
          onClick={() => onDeleteConfirmChange(document.id)}
          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
