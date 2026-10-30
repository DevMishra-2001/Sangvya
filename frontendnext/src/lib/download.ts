// Files are made on the server; the browser only saves or opens the blob
import { api } from "@/lib/api/client";

type Params = Record<string, string | number | undefined>;

async function fetchFile(path: string, params: Params | undefined, fallbackName: string) {
  const response = await api.get<Blob>(path, { params, responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  return { blob: response.data, name };
}

// Save to the user's downloads
export async function downloadFile(path: string, params?: Params, fallbackName = "download") {
  const { blob, name } = await fetchFile(path, params, fallbackName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Open (e.g. a PDF) in a new tab; the tab opens inside the click so pop-up blockers allow it
export async function openFile(path: string, params?: Params, fallbackName = "file.pdf") {
  const tab = window.open("", "_blank");
  try {
    const { blob } = await fetchFile(path, params, fallbackName);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
