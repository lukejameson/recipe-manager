import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { env } from '$env/dynamic/private';

// Derive a 32-byte encryption key from JWT_SECRET using scrypt
function getEncryptionKey(): Buffer {
  const jwtSecret = env?.JWT_SECRET || process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return scryptSync(jwtSecret, 'recipe-manager-encryption-salt', 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns format: iv:authTag:encrypted (all hex-encoded)
 */
export function encrypt(text: string): string {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
	let encrypted = cipher.update(text, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	const authTag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string (format: iv:authTag:encrypted)
 */
export function decrypt(encryptedText: string): string {
	const parts = encryptedText.split(':');
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted text format');
	}
	const [ivHex, authTagHex, encrypted] = parts;
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');
	const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}
