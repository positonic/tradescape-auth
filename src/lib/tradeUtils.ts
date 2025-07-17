export function formatDateTime(timestamp: number | bigint): string {
  // Convert BigInt to number if needed
  const numericTimestamp = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);

  // Extract date components
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  // Extract time components
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  // Construct the formatted date and time string
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseExchangePair(input: string): {
  exchange: string;
  pair: string;
  base: string;
  quote: string;
} {
  // Split the input string into exchange and pair parts
  const [exchangePart, pairPart] = input.split('-');

  // Capitalize the first letter of the exchange part
  const exchange = exchangePart?.slice(0) || '';

  // Replace underscores with slashes and convert the pair part to uppercase
  const pair = pairPart?.replace('_', '/').toUpperCase() || '';

  const base = pair.split('/')[0] || '';
  const quote = pair.split('/')[1] || '';

  return { exchange, pair, base, quote };
}

/**
 * BTC/USDT - base is BTC, quote is USDT
 * @param pair
 * @returns
 */
export function parseQuoteBaseFromPair(pair: string): {
  base: string;
  quote: string;
} {
  const base = pair.split('/')[0] || '';
  const quote = pair.split('/')[1] || '';
  return { base, quote };
}

/**
 *
 * @param input Turn "Bybit:BTC/USD" into "bybit-btc_usd"
 * @returns
 */
export function transformExchangePairFormat(input: string): string {
  // Lowercase the entire string
  let transformedString = input.toLowerCase();

  // Replace ':' with '-' and '/' with '_'
  transformedString = transformedString.replace(':', '-').replace('/', '_');

  return transformedString;
}

export function formatCurrency(amount: number | string): string {
  // Convert string to number if needed
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(numericAmount);
}

type ColorMap = Record<string, string>;

export const cryptoColors: ColorMap = {
  BTC: 'rgb(247, 147, 26)',
  BLUR: 'rgb(113, 87, 194)',
  MATIC: 'rgb(130, 71, 229)',
  USD: 'rgb(0, 122, 51)',
  ZETA: 'rgb(72, 130, 180)',
  JUP: 'rgb(255, 165, 0)',
  ONDO: 'rgb(255, 99, 71)',
  PYTH: 'rgb(255, 223, 186)',
  BEAM: 'rgb(76, 175, 80)',
  LENDS: 'rgb(250, 250, 250)',
  TIA: 'rgb(64, 224, 208)',
  GRT: 'rgb(96, 125, 139)',
  SUI: 'rgb(255, 105, 180)',
  ETH: 'rgb(108, 92, 231)',
  MAV: 'rgb(255, 215, 0)',
  UMA: 'rgb(0, 191, 255)',
  ARB: 'rgb(0, 206, 209)',
  STX: 'rgb(255, 69, 0)',
  JTO: 'rgb(153, 50, 204)',
  SUPER: 'rgb(233, 30, 99)',
  VET: 'rgb(0, 0, 255)',
  NEAR: 'rgb(255, 48, 79)',
  DOT: 'rgb(233, 30, 99)',
  ALGO: 'rgb(0, 178, 255)',
  ADA: 'rgb(57, 154, 202)',
  AVAX: 'rgb(227, 38, 54)',
  USDT: 'rgb(7, 193, 96)',
  USDC: 'rgb(255, 255, 255)',
  SOL: '#24AEA9',
};

export const sortDescending = (a: any, b: any) => {
  const aTime = typeof a.time === 'bigint' ? Number(a.time) : a.time;
  const bTime = typeof b.time === 'bigint' ? Number(b.time) : b.time;
  return bTime - aTime;
};
export const sortAscending = (a: any, b: any) => {
  const aTime = typeof a.time === 'bigint' ? Number(a.time) : a.time;
  const bTime = typeof b.time === 'bigint' ? Number(b.time) : b.time;
  return aTime - bTime;
};

/**
 *
 * @returns a timestamp representing the start of the current day in my timezone
 */
export function getStartOfDayTimestamp(): number {
  const now = new Date(); // Get the current date and time
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Set time to 00:00:00.000
  const timestamp = startOfDay.getTime(); // Get the timestamp in milliseconds since the Unix Epoch
  return timestamp;
}

function getStartOfDayOffsetTimestamp(daysOffset: number): number {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysOffset
  );
  return startOfDay.getTime();
}

export function getStartOfYesterdayTimestamp(): number {
  return getStartOfDayOffsetTimestamp(-1);
}

export function getStartOfTodayTimestamp(): number {
  return getStartOfDayOffsetTimestamp(0);
}

export function getStartOfLastWeekTimestamp(): number {
  return getStartOfDayOffsetTimestamp(-7);
}

export function getStartOfLastYearTimestamp(): number {
  const now = new Date();
  const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1); // January 1st of last year
  return startOfLastYear.getTime();
}

interface BalanceEntry {
  timestamp: number;
  totalBalance: number;
}

export function createSummary(entries: BalanceEntry[]): BalanceEntry[] {
  // Sort entries by timestamp to ensure they are processed in order
  const sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);

  // Prepare a result array to hold the closest entries for each 6-hour segment
  const result: BalanceEntry[] = [];

  // Define the four 6-hour segments in a day
  const segments = [0, 6, 12, 18];

  // Convert each segment into milliseconds for comparison
  const segmentTimes = segments.map((segment) => segment * 3600 * 1000);
  console.log('segmentTimes is ', segmentTimes);
  
  sortedEntries.forEach((entry) => {
    // Convert timestamp to a date object
    const date = new Date(entry.timestamp);
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0); // Reset to start of the day in UTC

    // Find the difference between the entry's time and the start of the day
    const diff = date.getTime() - startOfDay.getTime();

    // Determine the closest segment time before the entry's time
    const closestSegmentTime = segmentTimes.reduce((prev, curr) => {
      return curr <= diff && curr > prev ? curr : prev;
    }, 0);

    // Calculate the timestamp for the closest segment start
    const segmentTimestamp = startOfDay.getTime() + closestSegmentTime;

    // Check if we already have an entry for this segment
    const existingEntryIndex = result.findIndex(
      (e) => e.timestamp === segmentTimestamp
    );

    if (existingEntryIndex === -1) {
      // If no entry exists for this segment yet, add the current entry
      result.push({
        timestamp: segmentTimestamp,
        totalBalance: entry.totalBalance,
      });
    } else {
      // If an entry exists, determine which one is closer to the segment start
      const existingEntry = result[existingEntryIndex];
      if (existingEntry) {
        const existingDiff = Math.abs(existingEntry.timestamp - segmentTimestamp);
        const currentDiff = Math.abs(entry.timestamp - segmentTimestamp);

        if (currentDiff < existingDiff) {
          // If the current entry is closer, replace the existing entry
          result[existingEntryIndex] = {
            timestamp: segmentTimestamp,
            totalBalance: entry.totalBalance,
          };
        }
      }
    }
  });

  // Return the filtered and mapped entries
  return result;
}

export interface TradeResponseData {
  trades: any[];
  orders: any[];
  positions: any[];
  error: string;
  rotki?: boolean;
  firstTradeTime?: number | null;
  lastTradeTime?: number | null;
}