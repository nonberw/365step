// Session token: "remember me" keeps it in localStorage (own phone),
// otherwise sessionStorage (shared school tablet forgets it when the tab closes).
const KEY = "bsts-ai-lab-token";

export function loadToken(): string | null {
  try {
    // The tab's own session wins over a remembered one (two accounts side by side).
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null, remember = true) {
  try {
    sessionStorage.removeItem(KEY);
    if (!token) localStorage.removeItem(KEY);
    else if (remember) localStorage.setItem(KEY, token);
    else sessionStorage.setItem(KEY, token);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = loadToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Ошибка сервера");
  return data as T;
}

/** Sends a file as the raw request body (teacher materials, textbooks). */
export async function upload<T>(path: string, file: File, headers: Record<string, string> = {}): Promise<T> {
  const token = loadToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
      body: file,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 413) throw new ApiError(413, "Файл слишком большой (максимум 32 МБ)");
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Ошибка сервера");
  return data as T;
}

/** Fetches a protected file (PDF, CSV) with the session token. */
export async function fetchBlob(path: string): Promise<Blob> {
  const token = loadToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, "Не удалось загрузить файл");
  return res.blob();
}

export async function download(path: string, filename: string) {
  const url = URL.createObjectURL(await fetchBlob(path));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
