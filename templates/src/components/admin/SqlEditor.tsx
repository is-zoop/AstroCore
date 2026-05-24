import { useRef } from 'react';

type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const SQL_KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'and',
  'or',
  'as',
  'case',
  'when',
  'then',
  'else',
  'end',
  'left',
  'right',
  'inner',
  'outer',
  'join',
  'on',
  'group',
  'by',
  'order',
  'limit',
  'having',
  'distinct',
  'sum',
  'count',
  'avg',
  'min',
  'max',
  'coalesce',
  'to_date',
]);

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightSql(value: string) {
  const sql = value || 'SELECT ...';
  return sql.replace(
    /(--.*$)|('(?:''|[^'])*')|("(?:[^"]|"")*")|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_][\w$]*\b)|([(),.*=<>+-])/gm,
    (match, comment, singleQuote, doubleQuote, number, word, symbol) => {
      const safeMatch = escapeHtml(match);
      if (comment) return `<span class="text-slate-400">${comment}</span>`;
      if (singleQuote || doubleQuote) return `<span class="text-red-600">${safeMatch}</span>`;
      if (number) return `<span class="text-amber-600">${safeMatch}</span>`;
      if (word && SQL_KEYWORDS.has(word.toLowerCase())) return `<span class="text-blue-600 font-semibold">${safeMatch}</span>`;
      if (symbol) return `<span class="text-slate-500">${safeMatch}</span>`;
      return `<span class="text-sky-700">${safeMatch}</span>`;
    }
  );
}

export default function SqlEditor({ value, onChange }: SqlEditorProps) {
  const highlightRef = useRef<HTMLPreElement | null>(null);

  return (
    <div className="md:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700">SQL语句</div>
      <div className="relative h-80 overflow-hidden">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm leading-6"
          dangerouslySetInnerHTML={{ __html: highlightSql(value) }}
        />
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (!highlightRef.current) return;
            highlightRef.current.scrollTop = event.currentTarget.scrollTop;
            highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
          placeholder="SELECT ..."
          spellCheck={false}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-sm leading-6 text-transparent caret-slate-900 outline-none selection:bg-blue-200/70"
        />
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
        参数示例：select * from table where id=${'{abc}'}，abc为参数名，仅支持直连模式。
      </div>
    </div>
  );
}
