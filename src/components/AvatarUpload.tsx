"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface Props {
  value: string | null;
  name: string;
  onChange: (url: string | null) => void;
}

const MAX_SIZE_MB = 3;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function AvatarUpload({ value, name, onChange }: Props) {
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
      .from("profile-avatars")
      .upload(filename, file, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("profile-avatars")
      .getPublicUrl(data.path);

    onChange(urlData.publicUrl);
    setUploading(false);
  }

  async function handleRemove() {
    if (!value) return;
    const path = value.split("/profile-avatars/")[1];
    if (path) await supabase.storage.from("profile-avatars").remove([path]);
    onChange(null);
  }

  return (
    <div className="flex items-center gap-5">
      {/* Avatar preview */}
      <div className="relative w-20 h-20 shrink-0">
        {value ? (
          <Image
            src={value}
            alt={name}
            fill
            className="rounded-full object-cover border-2 border-cream/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-orange/20 flex items-center justify-center text-orange font-serif text-3xl border-2 border-cream/20">
            {name[0]}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-1.5 rounded-full text-sm border border-cream/20 text-cream-muted hover:border-orange hover:text-orange transition disabled:opacity-50"
          >
            {uploading ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-1.5 rounded-full text-sm border border-cream/20 text-cream-muted hover:border-red-400 hover:text-red-400 transition"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-cream-muted/50 text-xs">JPG, PNG, WebP · Max {MAX_SIZE_MB}MB</p>
        {error && <p className="text-orange text-xs">{error}</p>}
      </div>

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
    </div>
  );
}
