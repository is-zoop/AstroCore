import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

type Option = { value: string; label: string };

type Props = {
  values: string[];
  placeholder: string;
  options: Option[];
  emptyText?: string;
  onChange: (values: string[]) => void;
};

export default function SoftMultiSelect({ values, placeholder, options, emptyText = '暂无可选项', onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.filter((item) => values.includes(item.value));
  const orderedOptions = [
    ...selected,
    ...options.filter((item) => !values.includes(item.value)),
  ];
  const selectedText = selected.map((item) => item.label).join('，');

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className={cn(
          'min-h-12 w-full rounded-xl border bg-white px-3 py-2 text-left text-sm transition-all',
          'border-slate-200/80 text-slate-800 shadow-sm hover:border-blue-200 hover:shadow-md',
          'focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500',
          open && 'border-blue-500 ring-4 ring-blue-500/10 shadow-md'
        )}
      >
        <div className="flex min-h-7 items-center gap-2 pr-8">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            <span title={selectedText} className="block min-w-0 truncate rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              {selectedText}
            </span>
          )}
        </div>
        <ChevronDown className={cn('absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform', open && 'rotate-180 text-blue-500')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[160] overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="max-h-60 overflow-auto p-1.5">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">{emptyText}</div>
            ) : (
              orderedOptions.map((item) => {
                const isSelected = values.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggle(item.value)}
                    className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors', isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50')}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && <Check className="ml-3 h-4 w-4 shrink-0 text-blue-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
