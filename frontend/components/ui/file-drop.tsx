"use client";

import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const size = (n: number) =>
  n < 1024 * 1024
    ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n / 1024)} KB`
    : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n / 1024 / 1024)} MB`;

/**
 * Area tarik-lepas / klik untuk memilih satu file. Input file asli tetap ada (sr-only) supaya bisa
 * dijangkau keyboard dan pembaca layar; teks bawaan browser ("Choose File") tidak ditampilkan.
 */
export function FileDrop({
  id,
  label,
  accept,
  file,
  onFile,
  describedBy,
  hint,
}: {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  describedBy?: string;
  hint: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Kosongkan input asli saat file di state dihapus/diganti dari luar (mis. setelah upload berhasil).
  useEffect(() => {
    if (!file && input.current) input.current.value = "";
  }, [file]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          dragging ? "border-ring bg-muted" : "border-border bg-card hover:bg-muted",
        )}
      >
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          aria-label={label}
          aria-describedby={describedBy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <UploadCloud aria-hidden className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          Tarik & lepas file CSV di sini, atau <span className="underline">pilih file</span>
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2 pl-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet aria-hidden className="size-4 shrink-0" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{size(file.size)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Hapus ${file.name}`}
            onClick={() => onFile(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
