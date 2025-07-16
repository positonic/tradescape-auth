import CryptoJS from 'crypto-js';
import ccxt from 'ccxt';
import { ApiKeys } from '@/interfaces/ApiKeys';
import Exchange from '@/interfaces/Exchange';
import { exchanges } from '@/config/exchanges';

export interface ExchangeAuthResult {
  initializedExchanges: Exchange[];
  error?: string;
}

export type ExchangeProcessor<T> = (exchange: Exchange) => Promise<T>;

export function decryptKeys(encryptedKeys: string): string | null {
  const secretKeyPhrase = process.env.SECRET_KEY_PHRASE;
  if (!secretKeyPhrase) {
    return null;
  }

  try {
    // Decrypt the keys
    const decrypted = CryptoJS.AES.decrypt(
      encryptedKeys,
      secretKeyPhrase
    ).toString(CryptoJS.enc.Utf8);

    // Parse the decrypted JSON
    const keys = JSON.parse(decrypted);

    // Transform the data structure
    const transformedKeys = Object.entries(keys).map(
      ([exchangeName, credentials]: [string, any]) => ({
        exchange: exchangeName,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        ...(credentials.walletAddress && {
          walletAddress: credentials.walletAddress,
        }),
        ...(credentials.password && { password: credentials.password }),
      })
    );

    return JSON.stringify(transformedKeys);
  } catch (error) {
    return null;
  }
}

// Helper functions
function validateExchangeCredentials(
  exchangeConfig: any,
  exchangeKeys: any
): boolean {
  if (!exchangeKeys) return false;

  return Object.entries(exchangeConfig.requiredCredentials).every(
    ([key, required]) => {
      if (!required) return true;

      if (exchangeConfig.id === 'hyperliquid') {
        if (key === 'walletAddress') {
          return (
            typeof exchangeKeys.walletAddress === 'string' &&
            exchangeKeys.walletAddress.trim().length > 0
          );
        }
        return true;
      }

      // Special handling for OKX
      if (exchangeConfig.id === 'okx') {
        if (key === 'password') {
          return (
            typeof exchangeKeys.password === 'string' &&
            exchangeKeys.password.trim().length > 0
          );
        }
      }

      if (key === 'apiKey' || key === 'secret') {
        const value =
          key === 'secret' ? exchangeKeys.apiSecret : exchangeKeys.apiKey;
        return typeof value === 'string' && value.trim().length > 0;
      }
      return true;
    }
  );
}

function createExchangeCredentials(exchangeConfig: any, exchangeKeys: any) {
  if (exchangeConfig.id === 'hyperliquid') {
    return {
      walletAddress: exchangeKeys.walletAddress!.trim(),
    };
  }

  // Special handling for OKX
  if (exchangeConfig.id === 'okx') {
    return {
      apiKey: exchangeKeys.apiKey!.trim(),
      secret: exchangeKeys.apiSecret!.trim(),
      password: exchangeKeys.password!.trim(),
    };
  }

  return {
    apiKey: exchangeKeys.apiKey!.trim(),
    secret: exchangeKeys.apiSecret!.trim(),
  };
}
