import { db } from "~/server/db";
import { UserExchangeRepository } from "~/app/tradeSync/repositories/UserExchangeRepository";
import UserExchange from "~/app/tradeSync/UserExchange";

// Mock decrypt function - you'll need to implement this based on your encryption method
function decryptKeys(encryptedKeys: string): string | null {
  try {
    // TODO: Implement actual decryption logic
    // For now, assuming the keys are base64 encoded JSON
    return Buffer.from(encryptedKeys, 'base64').toString('utf-8');
  } catch (error) {
    console.error('Failed to decrypt keys:', error);
    return null;
  }
}

interface InitUserExchangeResult {
  userExchange: UserExchange | null;
  error?: string;
}

export async function initUserExchange(
  encryptedKeys: string,
  userId: string
): Promise<InitUserExchangeResult> {
  try {
    const userExchangeRepository = new UserExchangeRepository(db);

    const decryptedKeys = JSON.parse(decryptKeys(encryptedKeys) || '[]');
    if (!decryptedKeys.length) {
      return {
        userExchange: null,
        error: 'No valid API keys found',
      };
    }

    const userExchange = new UserExchange(
      parseInt(userId, 10),
      decryptedKeys,
      {},
      userExchangeRepository
    );

    return { userExchange };
  } catch (error) {
    console.error('Failed to initialize UserExchange:', error);
    return {
      userExchange: null,
      error: 'Failed to initialize exchange connection',
    };
  }
}