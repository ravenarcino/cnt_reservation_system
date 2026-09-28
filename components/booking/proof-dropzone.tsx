"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Drag-and-drop (or click) box for the cancellation proof, with a preview of
// the chosen file: a thumbnail for images, name and size for documents.
export function ProofDropzone({
  file,
  onChange,
  accept = "image/*,.pdf",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-neutral-50 p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-12 w-12 rounded object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-white text-muted-foreground ring-1 ring-border">
            <FileText className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove file"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-neutral-200 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed p-6 text-center transition-colors",
        over ? "border-brand bg-brand-soft" : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
      )}
    >
      <UploadCloud className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      <span className="text-sm font-medium">Drop a file or click to upload</span>
      <span className="text-xs text-muted-foreground">Image or PDF</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </button>
  );
}
