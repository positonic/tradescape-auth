import { UserExchangeRepository } from '../repositories/UserExchangeRepository';
import { initUserExchange } from '~/lib/userExchangeInit';
import { db } from '~/server/db';

export interface SyncResult {
  success: boolean;
  type: 'initial' | 'incremental';
  pairsFound: number;
  tradesFound: number;
  newPairs?: number;
  message: string;
}

export interface SyncProgress {
  phase: 'discovery' | 'trades' | 'storage';
  progress: number;
  currentExchange: string;
  currentSymbol?: string;
  pairsFound: number;
  tradesFound: number;
}

export class TradeSyncService {
  private userExchangeRepository: UserExchangeRepository;

  constructor() {
    this.userExchangeRepository = new UserExchangeRepository(db);
  }

  async syncTrades(
    userId: string,
    encryptedKeys: string,
    mode?: 'full' | 'incremental',
    since?: number
  ): Promise<SyncResult> {
    const { userExchange, error } = await initUserExchange(encryptedKeys, userId);
    
    if (error || !userExchange) {
      return {
        success: false,
        type: 'initial',
        pairsFound: 0,
        tradesFound: 0,
        message: error || 'Failed to initialize exchange'
      };
    }

    // Auto-detect mode if not provided
    const syncMode = mode || await this.detectSyncMode(userId);
    
    if (syncMode === 'full') {
      return await this.performInitialSync(userId, userExchange);
    } else {
      return await this.performIncrementalSync(userId, userExchange, since);
    }
  }

  private async detectSyncMode(userId: string): Promise<'full' | 'incremental'> {
    const existingPairs = await this.userExchangeRepository.findUserPairs(userId);
    const lastSync = await this.userExchangeRepository.getLastSyncTimes(userId);
    
    // Check if user has any pairs and recent sync activity
    const hasPairs = Object.keys(existingPairs).length > 0 && 
                    Object.values(existingPairs).some(pairs => pairs.length > 0);
    
    const hasRecentSync = lastSync && Object.keys(lastSync).length > 0;
    
    // First time user or no recent sync = full sync
    if (!hasPairs || !hasRecentSync) {
      return 'full';
    }
    
    return 'incremental';
  }

  private async performInitialSync(userId: string, userExchange: any): Promise<SyncResult> {
    try {
      console.log('🔄 Starting initial sync for user:', userId);
      
      // 1. Comprehensive pair discovery - check ALL symbols
      console.log('📊 Discovering all trading pairs...');
      const activePairs = await userExchange.updateUserPairs();
      
      // 2. Fetch ALL historical trades for discovered pairs
      console.log('📈 Fetching all historical trades...');
      const { allTrades } = await userExchange.getTrades();
      
      // 3. Update last sync times
      const exchanges = Object.keys(userExchange.exchanges);
      await this.userExchangeRepository.updateLastSyncTimes(userId, exchanges);
      
      console.log('✅ Initial sync completed');
      return {
        success: true,
        type: 'initial',
        pairsFound: Array.from(activePairs).length,
        tradesFound: allTrades.length,
        message: `Successfully discovered ${Array.from(activePairs).length} trading pairs and ${allTrades.length} trades`
      };
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      return {
        success: false,
        type: 'initial',
        pairsFound: 0,
        tradesFound: 0,
        message: 'Initial sync failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  private async performIncrementalSync(userId: string, userExchange: any, since?: number): Promise<SyncResult> {
    try {
      console.log('🔄 Starting incremental sync for user:', userId);
      
      // 1. Get current pairs from database
      const currentPairs = await userExchange.loadUserPairs();
      const currentPairCount = Object.values(currentPairs).flat().length;
      
      // 2. Check for new pairs periodically (every incremental sync)
      // This addresses the requirement that incremental sync must check for new pairs
      console.log('🔍 Checking for new trading pairs...');
      const newActivePairs = await userExchange.updateUserPairs(since);
      
      // 3. Fetch recent trades for all pairs (existing + new)
      console.log('📈 Fetching recent trades...');
      const { allTrades } = await userExchange.getTrades();
      
      // 4. Update last sync times
      const exchanges = Object.keys(userExchange.exchanges);
      await this.userExchangeRepository.updateLastSyncTimes(userId, exchanges);
      
      // Calculate new pairs discovered
      const newPairCount = Array.from(newActivePairs).length;
      const newPairsDiscovered = Math.max(0, newPairCount - currentPairCount);
      
      console.log('✅ Incremental sync completed');
      return {
        success: true,
        type: 'incremental',
        pairsFound: newPairCount,
        tradesFound: allTrades.length,
        newPairs: newPairsDiscovered,
        message: newPairsDiscovered > 0 
          ? `Found ${newPairsDiscovered} new trading pairs and ${allTrades.length} trades`
          : `Synced ${allTrades.length} trades from existing pairs`
      };
      
    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      return {
        success: false,
        type: 'incremental',
        pairsFound: 0,
        tradesFound: 0,
        message: 'Incremental sync failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }
}