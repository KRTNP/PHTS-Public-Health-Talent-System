'use client';

import { useState } from "react";

export function useRequestAttachmentPreviewState() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  return {
    previewOpen,
    previewUrl,
    previewName,
    setPreviewOpen,
    handlePreview,
  };
}
