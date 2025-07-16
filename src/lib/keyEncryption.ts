import CryptoJS from 'crypto-js';

// Client-side encryption key - in production, this should be more sophisticated
const CLIENT_ENCRYPTION_KEY = process.env.NEXT_PUBLIC_CLIENT_ENCRYPTION_KEY ?? 'default-client-key-change-in-production';

// Server-side encryption key - should be in environment variables
const SERVER_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY ?? 'default-server-key-change-in-production';

export interface EncryptedKeys {
  data: string;
  timestamp: number;
  expiresAt?: number;
}

export interface DecryptedKeys {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  walletAddress?: string;
  sandbox?: boolean;
}

// Client-side encryption for localStorage
export function encryptForStorage(keys: DecryptedKeys[]): string {
  const payload = {
    keys,
    timestamp: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };
  
  return CryptoJS.AES.encrypt(JSON.stringify(payload), CLIENT_ENCRYPTION_KEY).toString();
}

// Client-side decryption from localStorage
export function decryptFromStorage(encryptedData: string): DecryptedKeys[] | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, CLIENT_ENCRYPTION_KEY);
    const payload = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    
    // Check if expired
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }
    
    return payload.keys;
  } catch (error) {
    console.error('Failed to decrypt keys from storage:', error);
    return null;
  }
}

// Client-side encryption for server transmission
export function encryptForTransmission(keys: DecryptedKeys[]): string {
  const payload = {
    keys,
    timestamp: Date.now(),
    clientId: typeof window !== 'undefined' ? window.crypto.randomUUID() : 'server',
  };
  
  return CryptoJS.AES.encrypt(JSON.stringify(payload), CLIENT_ENCRYPTION_KEY).toString();
}

// Server-side decryption (from client transmission)
export function decryptFromTransmission(encryptedKeys: string): DecryptedKeys[] | null {
  try {
    // First decrypt with client key
    const decrypted = CryptoJS.AES.decrypt(encryptedKeys, CLIENT_ENCRYPTION_KEY);
    const payload = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    
    // Validate timestamp (reject if older than 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if (payload.timestamp < fiveMinutesAgo) {
      throw new Error('Encrypted keys are too old');
    }
    
    return payload.keys;
  } catch (error) {
    console.error('Failed to decrypt keys from transmission:', error);
    return null;
  }
}

// Server-side encryption for database storage (if needed)
export function encryptForDatabase(keys: DecryptedKeys[]): string {
  const payload = {
    keys,
    timestamp: Date.now(),
  };
  
  return CryptoJS.AES.encrypt(JSON.stringify(payload), SERVER_ENCRYPTION_KEY).toString();
}

// Server-side decryption from database (if needed)
export function decryptFromDatabase(encryptedKeys: string): DecryptedKeys[] | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedKeys, SERVER_ENCRYPTION_KEY);
    const payload = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    
    return payload.keys;
  } catch (error) {
    console.error('Failed to decrypt keys from database:', error);
    return null;
  }
}

// Storage management
export class KeyStorage {
  private static STORAGE_KEY = 'encrypted_exchange_keys';
  
  static save(keys: DecryptedKeys[], remember: boolean = false): void {
    if (!remember) {
      // Clear any existing keys
      this.clear();
      return;
    }
    
    const encrypted = encryptForStorage(keys);
    localStorage.setItem(this.STORAGE_KEY, encrypted);
  }
  
  static load(): DecryptedKeys[] | null {
    const encrypted = localStorage.getItem(this.STORAGE_KEY);
    if (!encrypted) return null;
    
    const keys = decryptFromStorage(encrypted);
    if (!keys) {
      // Clear invalid/expired keys
      this.clear();
      return null;
    }
    
    return keys;
  }
  
  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  static hasKeys(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}

// Exchange configuration
export interface ExchangeConfig {
  id: string;
  name: string;
  requiredCredentials: {
    apiKey: boolean;
    apiSecret: boolean;
    passphrase: boolean;
    walletAddress: boolean;
  };
}

export const EXCHANGE_CONFIGS: ExchangeConfig[] = [
  {
    id: 'binance',
    name: 'Binance',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: false, walletAddress: false }
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: true, walletAddress: false }
  },
  {
    id: 'kraken',
    name: 'Kraken',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: false, walletAddress: false }
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: true, walletAddress: false }
  },
  {
    id: 'bybit',
    name: 'Bybit',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: false, walletAddress: false }
  },
  {
    id: 'okx',
    name: 'OKX',
    requiredCredentials: { apiKey: true, apiSecret: true, passphrase: true, walletAddress: false }
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    requiredCredentials: { apiKey: false, apiSecret: false, passphrase: false, walletAddress: true }
  }
];

// Validation helpers
export function validateKeys(keys: DecryptedKeys[]): string[] {
  const errors: string[] = [];
  
  keys.forEach((key, index) => {
    if (!key.exchange) {
      errors.push(`Key ${index + 1}: Exchange is required`);
    }
    
    const config = EXCHANGE_CONFIGS.find(c => c.id === key.exchange);
    if (!config) {
      errors.push(`Key ${index + 1}: Unknown exchange ${key.exchange}`);
      return;
    }
    
    // Check required credentials based on exchange configuration
    if (config.requiredCredentials.apiKey && !key.apiKey) {
      errors.push(`Key ${index + 1}: API Key is required for ${config.name}`);
    }
    if (config.requiredCredentials.apiSecret && !key.apiSecret) {
      errors.push(`Key ${index + 1}: API Secret is required for ${config.name}`);
    }
    if (config.requiredCredentials.passphrase && !key.passphrase) {
      errors.push(`Key ${index + 1}: Passphrase is required for ${config.name}`);
    }
    if (config.requiredCredentials.walletAddress && !key.walletAddress) {
      errors.push(`Key ${index + 1}: Wallet Address is required for ${config.name}`);
    }
  });
  
  return errors;
}