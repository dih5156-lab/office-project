/**
 * ContactPicker — 주소록에서 이름을 멀티 선택하는 드롭다운 컴포넌트
 *
 * Props:
 *  - value: string[]          선택된 이름 배열
 *  - onChange: (v: string[]) => void
 *  - placeholder?: string
 */
import { useEffect, useRef, useState } from 'react';
import { Search, X, UserPlus, ChevronDown, Building2, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { useContactStore } from '../../store/contactStore';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export default function ContactPicker({ value, onChange, placeholder = '참석자 선택' }: Props) {
  const { contacts, fetchContacts } = useContactStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contacts.length === 0) fetchContacts();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = contacts.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q)
    );
  });

  function toggle(name: string) {
    if (value.includes(name)) {
      onChange(value.filter((n) => n !== name));
    } else {
      onChange([...value, name]);
    }
  }

  function remove(name: string) {
    onChange(value.filter((n) => n !== name));
  }

  // 선택된 연락처 정보
  const selectedContacts = value.map((name) => contacts.find((c) => c.name === name) ?? { name, type: 'external', company: '' });

  return (
    <div ref={wrapRef} className="relative">
      {/* 트리거 */}
      <div
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 border rounded-xl cursor-pointer transition-colors',
          open ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        {selectedContacts.length === 0 ? (
          <span className="text-sm text-gray-400 flex-1">{placeholder}</span>
        ) : (
          selectedContacts.map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full"
              onClick={(e) => e.stopPropagation()}
            >
              {c.name}
              {c.company ? <span className="text-blue-400">({c.company})</span> : null}
              <button
                onMouseDown={(e) => { e.stopPropagation(); remove(c.name); }}
                className="ml-0.5 text-blue-400 hover:text-blue-700"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
        <ChevronDown size={14} className={clsx('ml-auto text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 검색 */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름, 회사 검색..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* 목록 */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">검색 결과 없음</p>
            ) : (
              <>
                {/* 내부 직원 */}
                {filtered.filter((c) => c.type === 'internal').length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <UserCheck size={10} /> 내부 직원
                      </p>
                    </div>
                    {filtered.filter((c) => c.type === 'internal').map((c) => (
                      <ContactRow key={c.id} contact={c} selected={value.includes(c.name)} onToggle={() => toggle(c.name)} />
                    ))}
                  </>
                )}
                {/* 외부 거래처 */}
                {filtered.filter((c) => c.type === 'external').length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <Building2 size={10} /> 거래처·외부
                      </p>
                    </div>
                    {filtered.filter((c) => c.type === 'external').map((c) => (
                      <ContactRow key={c.id} contact={c} selected={value.includes(c.name)} onToggle={() => toggle(c.name)} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{value.length}명 선택됨</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); onChange([]); }}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                전체 해제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  selected,
  onToggle,
}: {
  contact: any;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onToggle(); }}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
        selected ? 'bg-blue-50' : 'hover:bg-gray-50'
      )}
    >
      <div
        className={clsx(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
          contact.type === 'internal' ? 'bg-blue-500' : 'bg-emerald-500'
        )}
      >
        {contact.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{contact.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {[contact.company, contact.position].filter(Boolean).join(' · ')}
        </p>
      </div>
      {selected && (
        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}
