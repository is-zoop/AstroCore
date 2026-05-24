import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

type SoftSelectOption = {
  value: string;
  label: string;
};

type SoftSelectProps = {
  value: string;
  placeholder: string;
  options: SoftSelectOption[];
  emptyText?: string;
  onChange: (value: string) => void;
};

export default function SoftSelect({ value, placeholder, options, emptyText = '暂无可选项', onChange }: SoftSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((item) => item.value === value);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className={cn(
          'w-full h-12 rounded-xl border bg-white px-4 text-left text-sm transition-all',
          'border-slate-200/80 text-slate-800 shadow-sm',
          'hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500',
          open && 'border-blue-500 ring-4 ring-blue-500/10 shadow-md'
        )}
      >
        <span className={cn('block truncate pr-8', !selected && 'text-slate-400')}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn('absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform', open && 'rotate-180 text-blue-500')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[160] overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="max-h-60 overflow-auto p-1.5">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">{emptyText}</div>
            ) : (
              options.map((item) => {
                const isSelected = item.value === value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    )}
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
