import { DocumentCategory } from '../../types';

export type DocumentForm = {
  title: string;
  content: string;
  category: DocumentCategory;
  tags: string[];
};
