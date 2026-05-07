"use client";

interface ResultDisplayProps {
  content: string;
  onCopy: () => void;
  copied: boolean;
  onClear: () => void;
}

export default function ResultDisplay({
  content,
  onCopy,
  copied,
  onClear,
}: ResultDisplayProps) {
  if (!content) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>✨</span> 생성된 문서
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <span>✅</span> 복사됨
              </>
            ) : (
              <>
                <span>📋</span> 복사
              </>
            )}
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-600 transition-colors"
          >
            <span>🗑️</span> 지우기
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 max-h-[600px] overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
          {content}
        </pre>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => {
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "document.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-600 transition-colors"
        >
          <span>💾</span> 다운로드
        </button>
      </div>
    </div>
  );
}
