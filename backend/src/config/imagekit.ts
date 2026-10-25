import ImageKit from "imagekit";
import { env } from "./env.js";
import { InternalServerError } from "../utils/httpErrors.js";

// Single shared ImageKit client, created on first use so the rest of the app
// runs without ImageKit keys (uploads just report that they're not configured).
let client: ImageKit | null = null;

export function getImageKit(): ImageKit {
  if (!env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) {
    throw new InternalServerError(
      "Image uploads aren't configured yet — set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT in backend/.env.",
    );
  }
  client ??= new ImageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
  });
  return client;
}
