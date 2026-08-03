import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface UppyFile {
  name: string;
  size: number;
  type: string;
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (
    file: UppyFile
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (result: { successful: Array<{ name: string }> }) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button.
 * Uploads directly to a presigned URL obtained from the backend.
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const batch = Array.from(files).slice(0, maxNumberOfFiles);
    setUploading(true);
    const successful: Array<{ name: string }> = [];
    for (const file of batch) {
      if (maxFileSize && file.size > maxFileSize) continue;
      try {
        const params = await onGetUploadParameters({ name: file.name, size: file.size, type: file.type });
        const res = await fetch(params.url, {
          method: params.method,
          body: file,
          headers: { "Content-Type": file.type, ...params.headers },
        });
        if (res.ok) successful.push({ name: file.name });
      } catch {
        // individual file failure — continue with the rest
      }
    }
    setUploading(false);
    onComplete?.({ successful });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple={maxNumberOfFiles > 1}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={buttonClassName}
      >
        {uploading ? "جارٍ الرفع..." : children}
      </Button>
    </div>
  );
}
