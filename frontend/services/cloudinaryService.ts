import { API_BASE_URL } from '@/services/authService';

export type CloudinaryResourceType = 'image' | 'video';
export type CloudinaryFolder = 'reports/images' | 'reports/videos' | 'profiles';

export type CloudinaryMedia = {
  secure_url: string;
  public_id: string;
  resource_type: CloudinaryResourceType;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  bytes?: number;
  createdAt?: string;
};

type SignUploadResponse = {
  apiKey: string;
  cloudName: string;
  context: string;
  folder: CloudinaryFolder;
  maxBytes: number;
  publicId: string;
  resourceType: CloudinaryResourceType;
  signature: string;
  tags: string;
  timestamp: number;
  uploadUrl: string;
};

type UploadOptions = {
  folder: CloudinaryFolder;
  idToken: string;
  mediaUri: string;
  mediaSizeBytes?: number;
  mimeType?: string;
  onProgress?: (progress: number) => void;
  resourceType?: CloudinaryResourceType;
};

const REQUEST_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithAuth<T>(path: string, idToken: string, options: RequestInit = {}): Promise<T> {
  let response: Response | null = null;
  const requestOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}${path}`, requestOptions);
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) break;
    } catch (error) {
      if (attempt === 2) throw error;
    }

    await sleep(500 * (attempt + 1));
  }

  if (!response) throw new Error('Request failed.');

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}

function getFileName(uri: string, resourceType: CloudinaryResourceType) {
  const cleanName = uri.split('/').pop()?.split('?')[0];
  if (cleanName && cleanName.includes('.')) return cleanName;
  return resourceType === 'video' ? 'upload.mp4' : 'upload.jpg';
}

function getMimeType(uri: string, resourceType: CloudinaryResourceType, fallback?: string) {
  if (fallback) return fallback;
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (resourceType === 'video') return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function getLocalAssetSize(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.size;
}

function xhrUpload(uploadUrl: string, formData: FormData, onProgress?: (progress: number) => void) {
  return new Promise<CloudinaryMedia>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.timeout = 120_000;
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          secure_url: data.secure_url,
          public_id: data.public_id,
          resource_type: data.resource_type,
          format: data.format,
          width: data.width,
          height: data.height,
          duration: data.duration,
          bytes: data.bytes,
          createdAt: data.created_at,
        });
        return;
      }
      reject(new Error(data.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload connection failed. Please try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again on a stable connection.'));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.send(formData);
  });
}

export function cloudinaryOptimizedUrl(url?: string, width = 900) {
  if (!url || !url.includes('/upload/')) return url || '';
  return url.replace('/upload/', `/upload/f_auto,q_auto:eco,c_limit,w_${width}/`);
}

export function cloudinaryVideoPosterUrl(url?: string, width = 900) {
  if (!url || !url.includes('/video/upload/')) return cloudinaryOptimizedUrl(url, width);
  const poster = url.replace('/video/upload/', `/video/upload/f_jpg,q_auto:eco,c_limit,w_${width}/`);
  return poster.replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg$1');
}

export async function uploadToCloudinary({
  folder,
  idToken,
  mediaUri,
  mediaSizeBytes,
  mimeType,
  onProgress,
  resourceType = 'image',
}: UploadOptions) {
  const bytes = mediaSizeBytes && Number.isFinite(mediaSizeBytes) && mediaSizeBytes > 0
    ? mediaSizeBytes
    : await getLocalAssetSize(mediaUri);
  const signature = await requestWithAuth<SignUploadResponse>('/media/cloudinary/sign-upload', idToken, {
    method: 'POST',
    body: JSON.stringify({ bytes, folder, resourceType }),
  });

  const formData = new FormData();
  formData.append('file', {
    name: getFileName(mediaUri, resourceType),
    type: getMimeType(mediaUri, resourceType, mimeType),
    uri: mediaUri,
  } as unknown as Blob);
  formData.append('api_key', signature.apiKey);
  formData.append('context', signature.context);
  formData.append('folder', signature.folder);
  formData.append('overwrite', 'false');
  formData.append('public_id', signature.publicId);
  formData.append('signature', signature.signature);
  formData.append('tags', signature.tags);
  formData.append('timestamp', String(signature.timestamp));

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const media = await xhrUpload(signature.uploadUrl, formData, onProgress);
      onProgress?.(100);
      return media;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upload failed. Please try again.');
}

export async function deleteCloudinaryMedia(
  idToken: string,
  publicId: string,
  resourceType: CloudinaryResourceType = 'image',
  userId?: string
) {
  return requestWithAuth<{ deleted: boolean }>('/media/cloudinary/delete', idToken, {
    method: 'POST',
    body: JSON.stringify({ publicId, resourceType, userId }),
  });
}
