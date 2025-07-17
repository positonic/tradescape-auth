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
    const startTime = Date.now();
    try {
      console.log('🚀 INITIAL SYNC STARTED for user:', userId);
      
      // 1. Comprehensive pair discovery - check ALL symbols
      console.log('📊 Discovering all trading pairs...');
      const pairDiscoveryStart = Date.now();
      const activePairs = await userExchange.updateUserPairs();
      
      // 1.5. Load pairs into UserExchange instance for getTrades()
      console.log('📋 Loading pairs into UserExchange instance...');
      await userExchange.loadUserPairs();
      const pairDiscoveryTime = Date.now() - pairDiscoveryStart;
      
      // 2. Fetch ALL historical trades for discovered pairs
      console.log('📈 Fetching all historical trades...');
      const tradesFetchStart = Date.now();
      const { allTrades } = await userExchange.getTrades();
      const tradesFetchTime = Date.now() - tradesFetchStart;
      
      // 3. Update last sync times
      const exchanges = Object.keys(userExchange.exchanges);
      await this.userExchangeRepository.updateLastSyncTimes(userId, exchanges);
      
      const totalTime = Date.now() - startTime;
      
      // Only log success if we found data
      if (Array.from(activePairs).length > 0 || allTrades.length > 0) {
        console.log('✅ INITIAL SYNC SUCCESS');
        console.log(`⏱️  Performance: ${totalTime}ms total (${pairDiscoveryTime}ms pairs, ${tradesFetchTime}ms trades)`);
        console.log(`📊 Results: ${Array.from(activePairs).length} pairs, ${allTrades.length} trades`);
      }
      
      return {
        success: true,
        type: 'initial',
        pairsFound: Array.from(activePairs).length,
        tradesFound: allTrades.length,
        message: `Successfully discovered ${Array.from(activePairs).length} trading pairs and ${allTrades.length} trades`
      };
      
    } catch (error) {
      console.error('❌ INITIAL SYNC FAILED:', error);
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
    const startTime = Date.now();
    try {
      console.log('⚡ QUICK SYNC STARTED for user:', userId);
      
      // 1. Get current pairs from database (skip discovery if we have recent pairs)
      const currentPairs = await userExchange.loadUserPairs();
      const currentPairCount = Object.values(currentPairs).flat().length;
      
      let newActivePairs;
      let pairDiscoveryTime = 0;
      
      // 2. Only check for new pairs if we have fewer than 5 pairs or it's been a while
      if (currentPairCount < 5) {
        console.log('🔍 Few pairs found, checking for new trading pairs...');
        const pairDiscoveryStart = Date.now();
        newActivePairs = await userExchange.updateUserPairs(since);
        pairDiscoveryTime = Date.now() - pairDiscoveryStart;
      } else {
        console.log('📋 Using existing pairs (use Full Sync to rediscover)');
        // Use existing pairs, convert to Set format expected by return
        newActivePairs = new Set(Object.values(currentPairs).flat().map((pair: any) => pair.symbol));
      }
      
      // 3. Fetch recent trades for known pairs only
      console.log('📈 Fetching recent trades for known pairs...');
      const tradesFetchStart = Date.now();
      const { allTrades } = await userExchange.getTrades();
      const tradesFetchTime = Date.now() - tradesFetchStart;
      
      // 4. Update last sync times
      const exchanges = Object.keys(userExchange.exchanges);
      await this.userExchangeRepository.updateLastSyncTimes(userId, exchanges);
      
      // Calculate new pairs discovered
      const newPairCount = Array.from(newActivePairs).length;
      const newPairsDiscovered = Math.max(0, newPairCount - currentPairCount);
      
      const totalTime = Date.now() - startTime;
      
      // Only log success if we found data
      if (newPairsDiscovered > 0 || allTrades.length > 0) {
        console.log('⚡ QUICK SYNC SUCCESS');
        console.log(`⏱️  Performance: ${totalTime}ms total (${pairDiscoveryTime}ms pairs, ${tradesFetchTime}ms trades)`);
        console.log(`📊 Results: ${newPairsDiscovered} new pairs, ${allTrades.length} trades`);
        if (currentPairCount >= 5 && pairDiscoveryTime === 0) {
          console.log('💡 Used existing pairs - use Full Sync to rediscover all pairs');
        }
      }
      
      return {
        success: true,
        type: 'incremental',
        pairsFound: newPairCount,
        tradesFound: allTrades.length,
        newPairs: newPairsDiscovered,
        message: currentPairCount >= 5 && pairDiscoveryTime === 0
          ? `Quick sync completed: ${allTrades.length} trades from ${currentPairCount} known pairs`
          : newPairsDiscovered > 0 
            ? `Found ${newPairsDiscovered} new trading pairs and ${allTrades.length} trades`
            : `Synced ${allTrades.length} trades from existing pairs`
      };
      
    } catch (error) {
      console.error('❌ QUICK SYNC FAILED:', error);
      return {
        success: false,
        type: 'incremental',
        pairsFound: 0,
        tradesFound: 0,
        message: 'Quick sync failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }
}