import { sha256 } from 'js-sha256';

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate a cryptographically random PKCE code verifier. */
export function generateCodeVerifier(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer.buffer);
}

/** Generate a PKCE code challenge from a verifier using SHA-256. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
    if (crypto.subtle) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    return base64UrlEncode(digest);
  }

  // Fallback for non-secure contexts where crypto.subtle is unavailable.
  const hash = sha256.arrayBuffer(verifier);
  return base64UrlEncode(hash);
}

/** Generate a random state parameter for CSRF protection. */
export function generateState(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer.buffer);
}
