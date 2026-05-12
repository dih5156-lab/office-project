import { Document, DocumentCategory } from '../../types';
import { DocumentForm } from './types';

export function getDocumentForm(document: Document): DocumentForm {
  return {
    title: document.title,
    content: document.content,
    category: document.category,
    tags: document.tags,
  };
}

export function filterDocuments(
  documents: Document[],
  category: DocumentCategory | 'all'
) {
  if (category === 'all') return documents;

  return documents.filter((document) => document.category === category);
}

export function addUniqueTag(form: DocumentForm, tag: string) {
  const normalized = tag.trim();
  if (!normalized || form.tags.includes(normalized)) return form;

  return {
    ...form,
    tags: [...form.tags, normalized],
  };
}
