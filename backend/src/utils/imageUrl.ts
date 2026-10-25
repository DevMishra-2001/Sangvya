import { z } from "zod";
import { env } from "../config/env.js";

// Images must come from our ImageKit account (uploaded via /api/upload)
export const isOurImage = (u: string) =>
  u.startsWith("https://ik.imagekit.io/") || (!!env.IMAGEKIT_URL_ENDPOINT && u.startsWith(env.IMAGEKIT_URL_ENDPOINT));

// Optional uploaded-image URL ("" / null = none)
export const optionalImageUrl = (message = "Upload the image first") =>
  z.preprocess((v) => v || undefined, z.string().url(message).max(500).refine(isOurImage, message).optional());
