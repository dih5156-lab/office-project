import { Filter, Search } from 'lucide-react';
import clsx from 'clsx';
import { DocumentCategory } from '../../types';
import { DOCUMENT_CATEGORIES } from '../../features/documents/constants';

type Props = {
  query: string;
  filterCategory: DocumentCategory | 'all';
  onQueryChange: (query: string) => void;
  onFilterChange: (category: DocumentCategory | 'all') => void;
};

export function DocumentSearchFilter({
  query,
  filterCategory,
  onQueryChange,
  onFilterChange,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="제목, 내용, 태그로 검색..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <button
          onClick={() => onFilterChange('all')}
          className={getFilterClass(filterCategory === 'all')}
        >
          전체
        </button>
        {DOCUMENT_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => onFilterChange(category)}
            className={getFilterClass(filterCategory === category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

function getFilterClass(active: boolean) {
  return clsx(
    'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
    active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  );
}
