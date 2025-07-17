import { db } from "~/server/db";
import { UserExchangeRepository } from "~/app/tradeSync/repositories/UserExchangeRepository";
import UserExchange from "~/app/tradeSync/UserExchange";
import { decryptFromTransmission } from "~/lib/keyEncryption";
import type { DecryptedKeys } from "~/lib/keyEncryption";

interface InitUserExchangeResult {
  userExchange: UserExchange | null;
  error?: string;
}

export async function initUserExchange(
  encryptedKeys: string,
  userId: string
): Promise<InitUserExchangeResult> {
  try {
    console.log('initUserExchange called with userId:', userId, 'type:', typeof userId);
    
    if (!userId) {
      return {
        userExchange: null,
        error: 'User ID is required',
      };
    }

    const userExchangeRepository = new UserExchangeRepository(db);

    const decryptedKeys = decryptFromTransmission(encryptedKeys);
    if (!decryptedKeys?.length) {
      return {
        userExchange: null,
        error: 'No valid API keys found',
      };
    }

    const userExchange = new UserExchange(
      userId,
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