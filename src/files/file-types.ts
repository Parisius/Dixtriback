export type FileKind = 'image' | 'document';

export interface DetectedType {
  mime: string;
  ext: string;
  kind: FileKind;
}

const OFFICE: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
const LEGACY_OFFICE: Record<string, string> = {
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
};

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const isPlainText = (buf: Buffer): boolean => {
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    // a multi-byte character may be cut at the sample boundary
    return sample.length === 8192 && (() => {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(sample.subarray(0, 8188));
        return true;
      } catch {
        return false;
      }
    })();
  }
};

/**
 * Decides what a file REALLY is from its bytes (magic numbers), never from
 * the client-declared type or name alone. Returns null for anything not on
 * the allowlist: raster images, PDF, Office documents, plain text / CSV.
 * SVG and HTML are deliberately excluded (they can carry script).
 */
export function detectType(buf: Buffer, declaredMime: string, originalName: string): DetectedType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38]) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
    return { mime: 'image/gif', ext: 'gif', kind: 'image' };
  }
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: 'webp', kind: 'image' };
  }
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf', kind: 'document' };

  const declared = (declaredMime || '').toLowerCase().split(';')[0].trim();
  const nameExt = (originalName.split('.').pop() || '').toLowerCase();

  // Office Open XML = a ZIP container; trust the declared type only when it is an Office one AND matches the extension.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && OFFICE[declared] && OFFICE[declared] === nameExt) {
    return { mime: declared, ext: OFFICE[declared], kind: 'document' };
  }
  // Legacy Office = OLE2 compound file.
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && LEGACY_OFFICE[declared] && LEGACY_OFFICE[declared] === nameExt) {
    return { mime: declared, ext: LEGACY_OFFICE[declared], kind: 'document' };
  }
  // Text / CSV: no magic number, so it must be clean UTF-8 with no NUL bytes.
  if ((declared === 'text/plain' || declared === 'text/csv') && ['txt', 'csv'].includes(nameExt) && isPlainText(buf)) {
    return declared === 'text/csv'
      ? { mime: 'text/csv', ext: 'csv', kind: 'document' }
      : { mime: 'text/plain', ext: 'txt', kind: 'document' };
  }
  return null;
}
