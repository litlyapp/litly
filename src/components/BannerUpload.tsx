"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function BannerUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError(`Image must be under ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);

    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from("event-banners")
      .upload(filename, file, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("event-banners")
      .getPublicUrl(data.path);

    onChange(urlData.publicUrl);
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleRemove() {
    if (!value) return;
    // Extract path from URL
    const path = value.split("/event-banners/")[1];
    if (path) {
      await supabase.storage.from("event-banners").remove([path]);
    }
    onChange(null);
  }

  return (
    <div>
      <label className="block text-cream-muted text-xs uppercase tracking-wider mb-1.5">
        Event banner (optional)
      </label>

      {value ? (
        <div className="relative rounded-2xl overflow-hidden">
          <Image
            src={value}
            alt="Event banner"
            width={800}
            height={300}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-navy/50 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-cream text-navy text-sm font-medium px-4 py-2 rounded-full hover:bg-cream/90 transition"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="bg-orange text-cream text-sm font-medium px-4 py-2 rounded-full hover:bg-orange/90 transition"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-cream/20 rounded-2xl p-10 text-center cursor-pointer hover:border-orange/50 transition"
        >
          {uploading ? (
            <p className="text-cream-muted text-sm">Uploading…</p>
          ) : (
            <>
              <p className="text-cream-muted text-sm mb-1">
                Drag & drop or click to upload
              </p>
              <p className="text-cream-muted/50 text-xs">
                JPG, PNG, WebP · Max {MAX_SIZE_MB}MB · Recommended: 1920×600px
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="text-orange text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
