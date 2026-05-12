import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useFileStore } from '../store/fileStore';
import { exportDocumentToExcel, exportDocumentsToExcel } from '../utils/exportExcel';
import { exportDocumentToPDF, exportDocumentsToPDF } from '../utils/exportPDF';
import { exportDocumentToWord } from '../utils/exportWord';
import { Document, DocumentCategory, UploadedFile } from '../types';
import { DocumentToolbar } from '../components/Documents/DocumentToolbar';
import { DocumentSearchFilter } from '../components/Documents/DocumentSearchFilter';
import { DocumentGrid } from '../components/Documents/DocumentGrid';
import { DocumentViewModal } from '../components/Documents/DocumentViewModal';
import { DocumentEditModal } from '../components/Documents/DocumentEditModal';
import { createEmptyDocumentForm } from '../features/documents/constants';
import {
  addUniqueTag,
  filterDocuments,
  getDocumentForm,
} from '../features/documents/documents';
import { DocumentForm } from '../features/documents/types';

export default function DocumentsPage() {
  const {
    documents,
    addDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    fetchDocuments,
  } = useDocumentStore();
  const {
    fetchFiles,
    uploadFiles,
    deleteFile,
    downloadFile,
    isUploading,
  } = useFileStore();
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState<DocumentCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Document | null>(null);
  const [form, setForm] = useState<DocumentForm>(() => createEmptyDocumentForm());
  const [tagInput, setTagInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [docFiles, setDocFiles] = useState<UploadedFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const searchedDocuments = query ? searchDocuments(query) : documents;
  const displayed = filterDocuments(searchedDocuments, filterCat);

  function openAddModal() {
    setEditTarget(null);
    setForm(createEmptyDocumentForm());
    setPendingFiles([]);
    setShowModal(true);
  }

  function openEditModal(document: Document) {
    setEditTarget(document);
    setForm(getDocumentForm(document));
    setPendingFiles([]);
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;

    const documentId = await saveDocument();
    if (pendingFiles.length > 0) {
      await uploadFiles(pendingFiles, documentId, 'document');
    }
    setShowModal(false);
  }

  async function saveDocument() {
    if (editTarget) {
      await updateDocument(editTarget.id, form);
      return editTarget.id;
    }

    const created = await addDocument(form);
    return created.id;
  }

  async function openViewDoc(document: Document) {
    setViewDoc(document);
    setExportMenuOpen(false);
    setDocFiles(await fetchFiles(document.id, 'document'));
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) {
      setPendingFiles((prev) => [...prev, ...selected]);
    }
    event.target.value = '';
  }

  async function handleAttachToExisting(document: Document, files: File[]) {
    await uploadFiles(files, document.id, 'document');
    setDocFiles(await fetchFiles(document.id, 'document'));
  }

  async function handleDeleteFile(file: UploadedFile) {
    await deleteFile(file.id);
    setDocFiles((prev) => prev.filter((item) => item.id !== file.id));
  }

  async function handleDeleteDocument(id: string) {
    await deleteDocument(id);
    setDeleteConfirm(null);
  }

  function addTag() {
    setForm((prev) => addUniqueTag(prev, tagInput));
    setTagInput('');
  }

  return (
    <div className="space-y-6">
      <DocumentToolbar
        onAdd={openAddModal}
        onExcel={() => exportDocumentsToExcel(displayed)}
        onPdf={() => exportDocumentsToPDF(displayed)}
      />
      <DocumentSearchFilter
        query={query}
        filterCategory={filterCat}
        onQueryChange={setQuery}
        onFilterChange={setFilterCat}
      />
      <DocumentGrid
        documents={displayed}
        query={query}
        deleteConfirm={deleteConfirm}
        onView={openViewDoc}
        onEdit={openEditModal}
        onDelete={handleDeleteDocument}
        onDeleteConfirmChange={setDeleteConfirm}
      />
      {viewDoc && (
        <DocumentViewModal
          document={viewDoc}
          files={docFiles}
          exportMenuOpen={exportMenuOpen}
          onExportMenuChange={setExportMenuOpen}
          onClose={() => setViewDoc(null)}
          onEdit={(document) => {
            openEditModal(document);
            setViewDoc(null);
          }}
          onExportPdf={exportDocumentToPDF}
          onExportWord={exportDocumentToWord}
          onExportExcel={exportDocumentToExcel}
          onAttachFiles={handleAttachToExisting}
          onDownloadFile={(file) => downloadFile(file.id, file.originalName)}
          onDeleteFile={handleDeleteFile}
        />
      )}
      {showModal && (
        <DocumentEditModal
          editTarget={editTarget}
          form={form}
          tagInput={tagInput}
          pendingFiles={pendingFiles}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onFormChange={setForm}
          onTagInputChange={setTagInput}
          onAddTag={addTag}
          onRemoveTag={(tag) => setForm((prev) => ({
            ...prev,
            tags: prev.tags.filter((item) => item !== tag),
          }))}
          onFileSelect={handleFileSelect}
          onRemovePendingFile={(index) => setPendingFiles((prev) =>
            prev.filter((_, itemIndex) => itemIndex !== index)
          )}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
