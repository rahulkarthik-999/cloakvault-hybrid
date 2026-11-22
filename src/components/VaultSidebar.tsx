import { useRef, useState } from 'react';
import { FileText, Upload, Plus, Trash2 } from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import type { VaultDocument } from '../types/vault';

interface VaultSidebarProps {
  vaults: VaultDocument[];
  activeVaultId: string;
  onSelectVault: (id: string) => void;
  onDeleteVault: (id: string) => void;
  onLoadSample: (sampleId: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onCreateBlankVault: () => void;
  uploadingFile: boolean;
}

export function VaultSidebar({
  vaults,
  activeVaultId,
  onSelectVault,
  onDeleteVault,
  onLoadSample,
  onUploadFile,
  onCreateBlankVault,
  uploadingFile,
}: VaultSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    await onUploadFile(file);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-[#E5E7EC] bg-[#FAFBFC] lg:w-[248px] lg:border-r lg:border-b-0">
      {/* Import Controls */}
      <div className="border-b border-[#E5E7EC] p-3">
        <div className="flex gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              dragging
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border-[#0E1015] bg-[#0E1015] text-white hover:bg-[#262A35]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{uploadingFile ? 'Parsing…' : 'Import File'}</span>
          </button>

          <button
            onClick={onCreateBlankVault}
            className="flex items-center justify-center rounded-md border border-[#E5E7EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0E1015] transition hover:bg-[#ECEEF2]"
            title="New blank document"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          id="vault-file-upload"
          name="vaultFileUpload"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="mt-1.5 text-center text-[10.5px] text-[#697083]">
          PDF, DOCX, TXT, CSV · Parsed locally
        </p>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#697083]">
          Local Workspace ({vaults.length})
        </div>

        <div className="space-y-1">
          {vaults.map((v) => {
            const active = v.id === activeVaultId;
            const shielded = v.entities.filter((e) => e.enabled).length;
            return (
              <div
                key={v.id}
                onClick={() => onSelectVault(v.id)}
                className={`group relative flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 transition ${
                  active
                    ? 'bg-white text-[#0E1015] shadow-xs ring-1 ring-[#E5E7EC]'
                    : 'text-[#3A3F4D] hover:bg-[#ECEEF2]'
                }`}
              >
                <FileText
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    active ? 'text-[#0E1015]' : 'text-[#9CA2B0]'
                  }`}
                />
                <div className="min-w-0 flex-1 pr-4">
                  <div className="truncate text-[12.5px] font-medium leading-snug">{v.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-[#697083]">
                    <span>{shielded} shielded</span>
                    {v.auditReport && (
                      <>
                        <span>·</span>
                        <span
                          className={
                            v.auditReport.riskScore >= 75
                              ? 'font-semibold text-red-700'
                              : v.auditReport.riskScore >= 45
                              ? 'font-semibold text-amber-700'
                              : 'font-semibold text-emerald-700'
                          }
                        >
                          Risk {v.auditReport.riskScore}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {vaults.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVault(v.id);
                    }}
                    className="absolute right-1.5 top-2 rounded p-1 text-[#9CA2B0] opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                    title="Delete from local IndexedDB"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sample Case Files */}
        <div className="mt-5 border-t border-[#E5E7EC] pt-3">
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#697083]">
            Sample Case Files
          </div>
          <div className="space-y-1">
            {SAMPLE_DOCUMENTS.map((s) => (
              <button
                key={s.id}
                onClick={() => onLoadSample(s.id)}
                className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left transition hover:bg-[#ECEEF2]"
              >
                <span className="text-[12px] font-medium text-[#1E2129]">{s.badge}</span>
                <span className="truncate text-[10.5px] text-[#697083]">{s.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
