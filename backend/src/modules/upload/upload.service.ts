// Image uploads to ImageKit. The client says what the image is for (`kind`);
// the server decides the folder and size, so nobody can write elsewhere.
// Every image is auto-rotated, resized and converted to WebP before upload.
import sharp from "sharp";
import { env } from "../../config/env.js";
import { getImageKit } from "../../config/imagekit.js";
import { BadRequestError, ForbiddenError } from "../../utils/httpErrors.js";
import type { UploadKind } from "./upload.schema.js";

interface KindRule {
  maxSize: number; // longest side in px
  // Folder under IMAGEKIT_FOLDER; null = the user isn't allowed this kind right now
  folder: (user: Express.AuthUser) => string | null;
}

const KINDS: Record<UploadKind, KindRule> = {
  // Uploaded while creating a company, so no company is needed yet
  "company-logo": { maxSize: 512, folder: () => "company-logos" },
  // Employee profile photo (HR adding an employee, or someone's own)
  "employee-photo": {
    maxSize: 512,
    folder: (user) => (user.companyId ? `companies/${user.companyId}/employees` : null),
  },
  // Check-in / check-out selfie
  "attendance-photo": {
    maxSize: 800,
    folder: (user) => (user.companyId && user.employeeId ? `companies/${user.companyId}/attendance/${user.employeeId}` : null),
  },
};

export async function uploadImage(user: Express.AuthUser, kind: UploadKind, file: { buffer: Buffer; originalname: string }) {
  if (!file.buffer?.length) throw new BadRequestError("The file is empty");

  const rule = KINDS[kind];
  const folder = rule.folder(user);
  if (!folder) throw new ForbiddenError("Your login isn't linked to an employee in this company yet");

  let image: Buffer;
  try {
    image = await sharp(file.buffer)
      .rotate() // honour the phone's EXIF orientation
      .resize({ width: rule.maxSize, height: rule.maxSize, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new BadRequestError("That file isn't a readable image");
  }

  const base = file.originalname.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || kind;
  const result = await getImageKit().upload({
    file: image,
    fileName: `${base}.webp`,
    folder: `${env.IMAGEKIT_FOLDER}/${folder}`,
    useUniqueFileName: true,
  });

  return { url: result.url, fileId: result.fileId, width: result.width, height: result.height };
}
