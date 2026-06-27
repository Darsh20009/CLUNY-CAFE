import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (
    file: { name: string; size: number; type: string }
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (result: { successful: Array<{ name: string; objectPath?: string }> }) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const successful: Array<{ name: string; objectPath?: string }> = [];
    try {
      const fileArray = Array.from(files).slice(0, maxNumberOfFiles);
      for (const file of fileArray) {
        if (maxFileSize && file.size > maxFileSize) {
          console.warn(`File ${file.name} exceeds max size`);
          continue;
        }
        const params = await onGetUploadParameters({ name: file.name, size: file.size, type: file.type });
        await fetch(params.url, {
          method: params.method,
          body: file,
          headers: { "Content-Type": file.type, ...params.headers },
        });
        successful.push({ name: file.name });
      }
      onComplete?.({ successful });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        multiple={maxNumberOfFiles > 1}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : children}
      </Button>
    </div>
  );
}
