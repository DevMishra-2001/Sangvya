// Every upload goes through storeFile(kind): the server picks allowed types, size, privacy and a company-wise folder
import multer from "multer";
import sharp from "sharp";
import { env } from "../../config/env.js";
import { getImageKit } from "../../config/imagekit.js";
import { BadRequestError, ForbiddenError } from "../../utils/httpErrors.js";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/heic", "image/heif"];
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MB = 1024 * 1024;

export type FileKind = "company-logo" | "employee-photo" | "attendance-photo" | "employee-document";

export interface StoreContext {
  companyId: number | null;
  employeeId?: number | null;
}

interface Rule {
  types: string[];
  maxBytes: number;
  resize?: number; // images: longest side in px, converted to WebP
  private?: boolean; // signed links only
  folder: (ctx: StoreContext) => string | null; // under IMAGEKIT_FOLDER; null = not allowed
}

const RULES: Record<FileKind, Rule> = {
  // Before a company exists the logo goes to a shared folder
  "company-logo": { types: IMAGE_TYPES, maxBytes: 5 * MB, resize: 512, folder: (c) => (c.companyId ? `companies/${c.companyId}/branding` : "company-logos") },
  "employee-photo": { types: IMAGE_TYPES, maxBytes: 5 * MB, resize: 512, folder: (c) => (c.companyId ? `companies/${c.companyId}/employees/photos` : null) },
  "attendance-photo": {
    types: IMAGE_TYPES,
    maxBytes: 5 * MB,
    resize: 800,
    folder: (c) => (c.companyId && c.employeeId ? `companies/${c.companyId}/attendance/${c.employeeId}` : null),
  },
  "employee-document": {
    types: DOCUMENT_TYPES,
    maxBytes: 10 * MB,
    private: true,
    folder: (c) => (c.companyId && c.employeeId ? `companies/${c.companyId}/employees/${c.employeeId}/documents` : null),
  },
};

export const MAX_FILE_BYTES = Math.max(...Object.values(RULES).map((r) => r.maxBytes));

// Multer for any upload route: memory only, one file; type and size are checked per kind in storeFile
export const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface StoredFile {
  url: string | null; // public kinds only
  fileId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

const slug = (name: string, fallback: string) =>
  name.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback;

export async function storeFile(kind: FileKind, ctx: StoreContext, file: UploadedFile | undefined): Promise<StoredFile> {
  if (!file?.buffer?.length) throw new BadRequestError("Choose a file to upload");
  const rule = RULES[kind];
  if (!rule.types.includes(file.mimetype)) {
    throw new BadRequestError(rule.types === IMAGE_TYPES ? "Upload an image (JPEG, PNG, WebP, GIF, SVG, HEIC)" : "Upload a PDF, an image or a Word file");
  }
  if (file.size > rule.maxBytes) throw new BadRequestError(`The file is larger than ${rule.maxBytes / MB} MB`);
  const folder = rule.folder(ctx);
  if (!folder) throw new ForbiddenError("Your login isn't linked to an employee in this company yet");

  let body = file.buffer;
  let fileName = file.originalname;
  let mimeType = file.mimetype;
  if (rule.resize) {
    try {
      body = await sharp(file.buffer)
        .rotate() // honour the phone's EXIF orientation
        .resize({ width: rule.resize, height: rule.resize, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestError("That file isn't a readable image");
    }
    fileName = `${slug(file.originalname, kind)}.webp`;
    mimeType = "image/webp";
  } else {
    const ext = file.originalname.match(/\.[a-z0-9]{1,6}$/i)?.[0]?.toLowerCase() ?? "";
    fileName = `${slug(file.originalname, "file")}${ext}`;
  }

  const result = await getImageKit().upload({
    file: body,
    fileName,
    folder: `${env.IMAGEKIT_FOLDER}/${folder}`,
    useUniqueFileName: true,
    isPrivateFile: Boolean(rule.private),
    tags: [kind, ...(ctx.companyId ? [`company-${ctx.companyId}`] : [])],
  });
  return {
    url: rule.private ? null : result.url,
    fileId: result.fileId,
    filePath: result.filePath,
    fileName: file.originalname.slice(0, 255),
    mimeType,
    size: body.length,
    width: result.width,
    height: result.height,
  };
}
