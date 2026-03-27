export const decodeSignatureBase64 = (payload?: string): Buffer | null => {
  if (!payload || typeof payload !== "string") return null;
  const base64 = payload.includes(",") ? payload.split(",")[1] : payload;
  if (!base64) return null;
  return Buffer.from(base64, "base64");
};
