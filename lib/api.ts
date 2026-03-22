const API_BASE =
  process.env.EXPO_PUBLIC_WORKER_URL?.replace(/\/+$/, "") ||
  "https://comicvault-v2.spierpont31.workers.dev";

const APP_TOKEN =
  process.env.EXPO_PUBLIC_APP_TOKEN || "CV_9f2d8a7c6b5e4d3f1a0c8b7e6d5f4a3";

export type GradeData = {
  mostLikely?: string | null;
  label?: string | null;
  rangeLow?: string | null;
  rangeHigh?: string | null;
  notes?: string[];
};

export type ScanRecord = {
  id: string;
  groupId: string;
  title: string;
  issue: string;
  publisher?: string | null;
  year?: string | null;
  variant?: string | null;
  frontKey?: string | null;
  backKey?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  createdAt?: string | null;
  recognitionReasoning?: string | null;
  recognitionConfidence?: number | null;
  keyFacts?: string[];
  storageBox?: string | null;
  storageSlot?: string | null;
  estimatedValue?: number | null;
  grade?: GradeData | null;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: BodyInit;
};

type UploadImageObjectArgs = {
  key: string;
  uri: string;
  mimeType?: string;
  fileName?: string;
};

type UploadImageLegacyArgs = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

type RecognizeArgs = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

function getDefaultHeaders(extra?: Record<string, string>) {
  return {
    "content-type": "application/json",
    "x-app-token": APP_TOKEN,
    ...extra,
  };
}

function joinUrl(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = joinUrl(path);

  const usingRawBody = options.rawBody !== undefined;
  const headers = usingRawBody
    ? {
        "x-app-token": APP_TOKEN,
        ...(options.headers || {}),
      }
    : getDefaultHeaders(options.headers);

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body != null
        ? JSON.stringify(options.body)
        : undefined,
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.ok === false) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeGrade(raw: any): GradeData | null {
  if (!raw || typeof raw !== "object") return null;

  const notes = parseStringArray(raw.notes);

  return {
    mostLikely: raw.mostLikely ?? raw.most_likely ?? raw.grade ?? null,
    label: raw.label ?? null,
    rangeLow: raw.rangeLow ?? raw.range_low ?? null,
    rangeHigh: raw.rangeHigh ?? raw.range_high ?? null,
    notes,
  };
}

function normalizeScan(raw: any): ScanRecord {
  const keyFacts = parseStringArray(raw.keyFacts ?? raw.key_facts);
  const grade = normalizeGrade(raw.grade);

  return {
    id: String(raw.id ?? ""),
    groupId: String(raw.groupId ?? raw.group_id ?? "my-vault"),
    title: String(raw.title ?? ""),
    issue: String(raw.issue ?? ""),
    publisher: raw.publisher ?? null,
    year: raw.year ?? null,
    variant: raw.variant ?? null,
    frontKey:
      raw.frontKey ??
      raw.front_key ??
      raw.frontImageKey ??
      raw.front_image_key ??
      null,
    backKey:
      raw.backKey ??
      raw.back_key ??
      raw.backImageKey ??
      raw.back_image_key ??
      null,
    frontUrl:
      raw.frontUrl ??
      raw.front_url ??
      raw.frontImageUrl ??
      raw.front_image_url ??
      raw.url ??
      null,
    backUrl:
      raw.backUrl ??
      raw.back_url ??
      raw.backImageUrl ??
      raw.back_image_url ??
      null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    recognitionReasoning:
      raw.recognitionReasoning ??
      raw.recognition_reasoning ??
      raw.reasoning ??
      null,
    recognitionConfidence: parseNumber(
      raw.recognitionConfidence ??
        raw.recognition_confidence ??
        raw.confidence
    ),
    keyFacts,
    storageBox: raw.storageBox ?? raw.storage_box ?? null,
    storageSlot: raw.storageSlot ?? raw.storage_slot ?? null,
    estimatedValue: parseNumber(raw.estimatedValue ?? raw.estimated_value),
    grade,
  };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read image at uri: ${uri}`);
  }

  const blob = await response.blob();
  if (!blob) {
    throw new Error("Image blob could not be created.");
  }

  return blob;
}

function inferMimeTypeFromUri(uri?: string | null) {
  if (!uri) return "image/jpeg";

  const clean = uri.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function inferFileNameFromUri(uri?: string | null, fallback = "image.jpg") {
  if (!uri) return fallback;

  const clean = uri.split("?")[0];
  const name = clean.split("/").pop();
  if (name && name.includes(".")) return name;

  return fallback;
}

function toUploadParams(
  arg1: string | UploadImageObjectArgs,
  arg2?: UploadImageLegacyArgs
): UploadImageObjectArgs {
  if (typeof arg1 === "string") {
    return {
      key: arg1,
      uri: arg2?.uri || "",
      mimeType: arg2?.mimeType,
      fileName: arg2?.fileName,
    };
  }

  return arg1;
}

export function getDefaultGroupId() {
  return "my-vault";
}

export function r2PublicUrl(key?: string | null, url?: string | null) {
  if (url) return url;
  if (!key) return null;
  const clean = String(key).replace(/^\/+/, "");
  return `${API_BASE}/r2/${clean}`;
}

export async function fetchScans(groupId = "my-vault"): Promise<ScanRecord[]> {
  const data = await requestJson<{
    ok: boolean;
    scans?: any[];
    items?: any[];
    data?: any[];
  }>(`/scans?groupId=${encodeURIComponent(groupId)}`);

  const rows = data.scans || data.items || data.data || [];
  return rows.map(normalizeScan);
}

export async function fetchScanById(
  scanId: string
): Promise<ScanRecord | null> {
  const data = await requestJson<{
    ok: boolean;
    scan?: any;
    item?: any;
    data?: any;
  }>(`/scan/${encodeURIComponent(scanId)}`);

  const raw = data.scan || data.item || data.data || null;
  return raw ? normalizeScan(raw) : null;
}

export async function createScan(input: {
  groupId: string;
  title: string;
  issue: string;
  publisher?: string | null;
  year?: string | null;
  variant?: string | null;
  frontKey: string;
  backKey?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  recognitionReasoning?: string | null;
  recognitionConfidence?: number | null;
  keyFacts?: string[];
}) {
  const result = await requestJson<{
    ok: boolean;
    scanId?: string;
    id?: string;
    scan?: any;
    item?: any;
    data?: any;
  }>("/scan", {
    method: "POST",
    body: {
      groupId: input.groupId,
      title: input.title,
      issue: input.issue,
      publisher: input.publisher ?? null,
      year: input.year ?? null,
      variant: input.variant ?? null,
      frontKey: input.frontKey,
      backKey: input.backKey ?? null,
      frontUrl: input.frontUrl ?? null,
      backUrl: input.backUrl ?? null,
      recognitionReasoning: input.recognitionReasoning ?? null,
      recognitionConfidence: input.recognitionConfidence ?? null,
      keyFacts: input.keyFacts ?? [],
    },
  });

  return result;
}

export async function updateScan(
  scanId: string,
  input: {
    groupId: string;
    title: string;
    issue: string;
  }
) {
  return requestJson<{ ok: boolean }>(`/scan/${encodeURIComponent(scanId)}`, {
    method: "PUT",
    body: input,
  });
}

export async function deleteScan(scanId: string) {
  return requestJson<{ ok: boolean }>(`/scan/${encodeURIComponent(scanId)}`, {
    method: "DELETE",
  });
}

export async function uploadImage(
  arg1: string | UploadImageObjectArgs,
  arg2?: UploadImageLegacyArgs
) {
  const params = toUploadParams(arg1, arg2);

  if (!params.key?.trim()) {
    throw new Error("Upload key is missing.");
  }

  if (!params.uri?.trim()) {
    throw new Error("Upload image uri is missing.");
  }

  const blob = await uriToBlob(params.uri);
  const mimeType =
    params.mimeType ||
    blob.type ||
    inferMimeTypeFromUri(params.uri) ||
    "image/jpeg";

  const uploadUrl = `${API_BASE}/upload?key=${encodeURIComponent(params.key)}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "x-app-token": APP_TOKEN,
      "content-type": mimeType,
    },
    body: blob,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || "Upload failed");
  }

  return data as { ok: boolean; key: string; url: string };
}

export async function recognizeComic(params: RecognizeArgs) {
  if (!params?.uri?.trim()) {
    throw new Error("Recognition image uri is missing.");
  }

  const blob = await uriToBlob(params.uri);
  const mimeType =
    params.mimeType ||
    blob.type ||
    inferMimeTypeFromUri(params.uri) ||
    "image/jpeg";

  const response = await fetch(`${API_BASE}/recognize`, {
    method: "POST",
    headers: {
      "x-app-token": APP_TOKEN,
      "content-type": mimeType,
    },
    body: blob,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || "Recognition failed");
  }

  return {
    title: String(data?.title ?? "").trim(),
    issue: String(data?.issue ?? "").trim(),
    publisher: data?.publisher ? String(data.publisher) : "",
    confidence: parseNumber(data?.confidence),
    reasoning: data?.reasoning ? String(data.reasoning) : "",
    year: data?.year ? String(data.year) : "",
    variant: data?.variant ? String(data.variant) : "",
    keyFacts: parseStringArray(data?.keyFacts ?? data?.key_facts),
  };
}

/* backward-compatible exports */

export async function recognizeCover(params: RecognizeArgs) {
  return recognizeComic(params);
}

export async function uploadCoverImage(
  arg1: string | UploadImageObjectArgs,
  arg2?: UploadImageLegacyArgs
) {
  return uploadImage(arg1 as any, arg2);
}

export async function saveScan(input: {
  groupId: string;
  title: string;
  issue: string;
  publisher?: string | null;
  year?: string | null;
  variant?: string | null;
  frontKey: string;
  backKey?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  recognitionReasoning?: string | null;
  recognitionConfidence?: number | null;
  keyFacts?: string[];
}) {
  return createScan(input);
}

export function getCoverImageUrl(scan?: Partial<ScanRecord> | null) {
  if (!scan) return null;
  return r2PublicUrl(scan.frontKey || null, scan.frontUrl || null);
}

export function getBackImageUrl(scan?: Partial<ScanRecord> | null) {
  if (!scan) return null;
  return r2PublicUrl(scan.backKey || null, scan.backUrl || null);
}

export function inferImageMeta(uri?: string | null) {
  return {
    mimeType: inferMimeTypeFromUri(uri),
    fileName: inferFileNameFromUri(uri),
  };
}

export { API_BASE, APP_TOKEN };