import { useCallback, useMemo } from 'react';

// Shared room key derived from a constant (in production, this could be per-room)
const ROOM_SALT = 'ecash-pulse-chat-v1';

export const useChatEncryption = () => {
  // Derive encryption key from room identifier
  const deriveKey = useCallback(async (): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ROOM_SALT),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('ecash-pulse-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }, []);

  const encrypt = useCallback(async (plaintext: string): Promise<{ encrypted: string; iv: string }> => {
    const key = await deriveKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );

    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  }, [deriveKey]);

  const decrypt = useCallback(async (encryptedBase64: string, ivBase64: string): Promise<string> => {
    try {
      const key = await deriveKey();
      const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Unable to decrypt message]';
    }
  }, [deriveKey]);

  return { encrypt, decrypt };
};
