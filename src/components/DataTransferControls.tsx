import React, { useRef, useState } from 'react';
import { Download, LoaderCircle, Upload } from 'lucide-react';
import { downloadPlannerBackup, importPlannerBackup } from '../dataBackup';
import { useAppStore } from '../store';

export const DataTransferControls: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const restoreFromBackup = useAppStore((state) => state.restoreFromBackup);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm(`导入“${file.name}”将覆盖此电脑上的现有数据，是否继续？`)) return;

    setIsImporting(true);
    setMessage(null);
    setIsError(false);
    try {
      const data = await importPlannerBackup(file);
      restoreFromBackup(data);
      setMessage('导入成功，可使用撤销恢复导入前的数据');
      setIsImporting(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '导入失败，请检查备份文件');
      setIsImporting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          try {
            downloadPlannerBackup();
          } catch {
            setIsError(true);
            setMessage('导出失败，请稍后重试');
          }
        }}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
        title="将全部数据导出为 JSON 备份"
      >
        <Download className="h-3.5 w-3.5" />
        <span>导出数据</span>
      </button>
      <button
        type="button"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600 disabled:cursor-wait disabled:opacity-60"
        title="从 Planner JSON 备份恢复全部数据"
      >
        {isImporting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        <span>{isImporting ? '导入中' : '导入数据'}</span>
      </button>
      <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
      {message ? (
        <div role="status" className={`absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg ${isError ? 'border-rose-200 text-rose-600' : 'border-emerald-200 text-emerald-600'}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
};
