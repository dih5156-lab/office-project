import clsx from 'clsx';
import { ScheduleCategory } from '../../types';
import { ALL_CATEGORIES, CATEGORY_COLORS } from '../../features/schedule/constants';

type Props = {
  value: ScheduleCategory | 'all';
  onChange: (category: ScheduleCategory | 'all') => void;
};

export function ScheduleCategoryFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange('all')}
        className={clsx(
          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
          value === 'all'
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
      >
        전체
      </button>
      {ALL_CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onChange(value === category ? 'all' : category)}
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium transition-colors',
            value === category
              ? `${CATEGORY_COLORS[category]} text-white`
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
