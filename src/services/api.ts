let inMemoryBearerToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  inMemoryBearerToken = token;
}

export function getInMemoryToken(): string | null {
  return inMemoryBearerToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string>;

  constructor(message: string, status: number, code?: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'JanConnect');
  if (inMemoryBearerToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryBearerToken}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiError(
      (data.error as string) || `Request failed (${res.status})`,
      res.status,
      data.code as string | undefined,
      data.errors as Record<string, string> | undefined
    );
  }

  return data as T;
}

export function uploadFormDataWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', 'JanConnect');
    if (inMemoryBearerToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${inMemoryBearerToken}`);
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener('load', () => {
      let data: Record<string, unknown> = {};
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(data as T);
      } else {
        reject(
          new ApiError(
            (data.error as string) || `Upload failed (${xhr.status})`,
            xhr.status,
            data.code as string | undefined,
            data.errors as Record<string, string> | undefined
          )
        );
      }
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError('Network error while submitting report.', 0));
    });

    xhr.send(formData);
  });
}
