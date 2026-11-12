import { isIconDataUrl } from "@/lib/collection";

/**
 * Icon pipeline for the link editor.
 *
 * Both entry points end in the same place: a square PNG data URL that is
 * stored inside the link record, so the image travels with the app instead of
 * depending on the site or on a third-party icon endpoint.
 */

/** Stored pixel size: enough for a 42px card and a 2x screen, small on disk. */
const ICON_SIZE = 96;
const MIN_ICON_SIZE = 48;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

const UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Value for the `<input type="file" accept>` attribute. */
export const ICON_UPLOAD_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico,.png,.jpg,.jpeg,.webp,.gif,.svg";

/** A recoverable icon problem, shown next to the field in Portuguese. */
export class IconError extends Error {}

function looksEncoded(value: string): boolean {
  return value.startsWith("data:image/");
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve(image)
        : reject(new IconError("A imagem não tem um tamanho que o navegador entenda."));
    image.onerror = () =>
      reject(
        new IconError(
          "Não foi possível ler esta imagem. Use PNG, JPG, WEBP, GIF ou SVG.",
        ),
      );
    image.src = source;
  });
}

/** Draws the image on a transparent square canvas and encodes a PNG data URL. */
async function toIconDataUrl(source: string): Promise<string> {
  const image = await loadImage(source);
  const largest = Math.max(image.naturalWidth, image.naturalHeight);

  for (let size = ICON_SIZE; size >= MIN_ICON_SIZE; size = Math.floor(size / 2)) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context)
      throw new IconError("Seu navegador não conseguiu preparar a imagem.");

    // Keep the aspect ratio and center the art, without cropping it.
    const scale = Math.min(size / largest, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      Math.round((size - width) / 2),
      Math.round((size - height) / 2),
      width,
      height,
    );

    let data: string;
    try {
      data = canvas.toDataURL("image/png");
    } catch {
      throw new IconError(
        "O navegador bloqueou a leitura desta imagem. Use um arquivo PNG, JPG ou WEBP.",
      );
    }

    if (isIconDataUrl(data)) return data;
    // Only downscale again when the encoded PNG is what exceeded the budget.
    if (!looksEncoded(data)) break;
  }

  throw new IconError(
    "A imagem ficou grande demais para guardar com o link. Tente uma menor.",
  );
}

/** Captures the site favicon through the same-origin icon proxy. */
export async function iconFromFavicon(url: string): Promise<string> {
  const host = new URL(url).hostname;
  let response: Response;
  try {
    response = await fetch(
      `/api/favicon?domain=${encodeURIComponent(host)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new IconError(
      "Não foi possível buscar o favicon agora. Verifique a conexão ou envie uma imagem.",
    );
  }

  if (!response.ok)
    throw new IconError(
      response.status === 404
        ? "Este site não tem um favicon público. Envie uma imagem."
        : "Não foi possível buscar o favicon deste site. Envie uma imagem.",
    );

  const blob = await response.blob();
  if (!blob.type.startsWith("image/"))
    throw new IconError("O favicon deste site não é uma imagem. Envie uma imagem.");

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await toIconDataUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Turns a local file chosen by the user into a stored icon. */
export async function iconFromFile(file: File): Promise<string> {
  if (file.type && !UPLOAD_TYPES.has(file.type.toLowerCase()))
    throw new IconError("Use uma imagem PNG, JPG, WEBP, GIF, SVG ou ICO.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new IconError("A imagem passa de 2 MB. Escolha um arquivo menor.");

  const objectUrl = URL.createObjectURL(file);
  try {
    return await toIconDataUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
