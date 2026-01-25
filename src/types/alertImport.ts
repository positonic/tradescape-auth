// Types for AI-powered bulk alert import

export interface ParsedAlert {
  id: string; // UUID for React key
  coinSymbol: string;
  pairId: number | null; // null if unmatched
  pairSymbol?: string; // Display name for matched pair
  type: "PRICE" | "CANDLE";
  threshold: string;
  direction: "ABOVE" | "BELOW";
  interval: string | null;
  originalText: string;
  confidence: "high" | "medium" | "low";
  notes: string;
  isValid: boolean;
  validationError?: string;
}

export interface ParseAlertsResponse {
  alerts: ParsedAlert[];
  unparseable: string[]; // Lines that couldn't be parsed
  availablePairs: Array<{ id: number; symbol: string }>;
}

export interface BulkCreateResult {
  created: number;
  failed: number;
  errors: string[];
}

// OpenAI response structure for alert parsing
export interface AIAlertParseResult {
  alerts: Array<{
    coinSymbol: string;
    type: "PRICE" | "CANDLE";
    threshold: number;
    direction: "ABOVE" | "BELOW";
    interval: string | null;
    originalText: string;
    confidence: "high" | "medium" | "low";
    notes: string;
  }>;
  unparseable: string[];
}
