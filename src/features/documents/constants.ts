import { DocumentCategory } from '../../types';
import { DocumentForm } from './types';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  '계획서',
  '보고서',
  '회의록',
  '제안서',
  '매뉴얼',
  '기타',
];

export const DOCUMENT_CATEGORY_COLORS: Record<DocumentCategory, string> = {
  계획서: 'bg-blue-100 text-blue-700',
  보고서: 'bg-green-100 text-green-700',
  회의록: 'bg-purple-100 text-purple-700',
  제안서: 'bg-orange-100 text-orange-700',
  매뉴얼: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-700',
};

export function createEmptyDocumentForm(): DocumentForm {
  return {
    title: '',
    content: '',
    category: '기타',
    tags: [],
  };
}
