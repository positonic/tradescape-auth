import { KeyStorage, encryptForTransmission } from "~/lib/keyEncryption";
import { notifications } from "@mantine/notifications";

/**
 * Shared utility for getting encrypted keys for API calls
 * Returns encrypted keys if available, or shows notification and returns null
 */
export function getEncryptedKeysForTransmission(): string | null {
  try {
    const keys = KeyStorage.load();
    console.log('🔑 Keys loaded:', keys ? `${keys.length} keys found` : 'No keys found');
    
    if (keys && keys.length > 0) {
      console.log('🔐 Encrypting keys for transmission...');
      const encrypted = encryptForTransmission(keys);
      return encrypted;
    } else {
      console.warn('⚠️ No API keys found');
      notifications.show({
        title: 'No API Keys Found',
        message: 'Please add your exchange API keys using the Key Manager before performing this action.',
        color: 'orange',
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading or encrypting keys:', error);
    notifications.show({
      title: 'Key Error',
      message: 'Failed to access stored keys. Please try adding them again.',
      color: 'red',
    });
    return null;
  }
}

/**
 * Check if user has stored keys
 */
export function hasStoredKeys(): boolean {
  try {
    return KeyStorage.hasKeys();
  } catch (error) {
    console.error('❌ Error checking for stored keys:', error);
    return false;
  }
}