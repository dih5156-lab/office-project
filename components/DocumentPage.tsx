"use client";

import { useState, useCallback } from "react";
import DocumentForm from "@/components/DocumentForm";
import ResultDisplay from "@/components/ResultDisplay";

interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  rows?: number;
}

interface DocumentPageProps {
  type: string;
  pageTitle: string;
  pageIcon: string;
  formTitle: string;
  formDescription: string;
  fields: Field[];
}

export default function DocumentPage({
  type,
  pageTitle,
  pageIcon,
  formTitle,
  formDescription,
  fields,
}: DocumentPageProps) {
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(async (data: Record<string, string>) => {
    setIsLoading(true);
    setError("");
    setResult("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "생성에 실패했습니다.");
      }

      setResult(json.content);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">{pageIcon}</span>
          {pageTitle}
        </h1>
        <p className="text-gray-500 mt-2 ml-16">
          아래 양식을 작성하면 AI가 자동으로 문서를 생성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form */}
        <div>
          <DocumentForm
            title={formTitle}
            description={formDescription}
            fields={fields}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {/* Result */}
        <div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
              <p className="text-red-700 text-sm flex items-center gap-2">
                <span>❌</span> {error}
              </p>
            </div>
          )}

          {!result && !error && !isLoading && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              <div className="text-5xl mb-3">📄</div>
              <p className="text-sm">왼쪽 양식을 작성하고<br />AI 자동 생성 버튼을 클릭하세요.</p>
            </div>
          )}

          {isLoading && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="flex justify-center mb-4">
                <svg className="animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">AI가 문서를 작성 중입니다...</p>
              <p className="text-gray-400 text-sm mt-1">잠시만 기다려주세요.</p>
            </div>
          )}

          {result && (
            <ResultDisplay
              content={result}
              onCopy={handleCopy}
              copied={copied}
              onClear={() => setResult("")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
