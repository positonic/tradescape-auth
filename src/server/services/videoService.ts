import { type PrismaClient } from "@prisma/client";
import type { TranscriptionSetups } from "~/types/transcription";
import { VideoRepository } from "~/server/repositories/videoRepository";
import { db } from "~/server/db";
import type { Caption } from "~/utils/vttParser";

// Define types based on Prisma schema
type VideoCreateInput = {
  id?: string;
  slug?: string;
  title?: string;
  videoUrl: string;
  transcription?: string;
  status: string;
  userId: string;
  isSearchable?: boolean;
};

type VideoUpdateInput = {
  slug?: string;
  title?: string;
  videoUrl?: string;
  transcription?: string;
  status?: string;
  isSearchable?: boolean;
  updatedAt?: Date;
};

// type TranscriptionSetups = {
//   generalMarketContext: string;
//   coins: Array<{
//     coin: string;
//     sentiment: 'bullish' | 'bearish' | 'neutral';
//     marketContext: string;
//     tradeSetups: Array<{
//       position: 'long' | 'short' | 'abstain';
//       entryTriggers: string;
//       entryPrice: string;
//       timeframe: string;
//       takeProfit: string;
//       t1: string;
//       t2: string;
//       t3: string;
//       stopLoss: string;
//       stopLossPrice: number;
//       invalidation: string;
//       confidenceLevel: string;
//       transcriptExcerpt: string;
//     }>;
//   }>;
// };

const prompts = {
  'trade-setups': `Below is a transcript of a crypto trading video from an influencer. The transcript contains both trade ideas and non-trading commentary. Please extract a list of trade ideas for each crypto coin or token mentioned. For each coin/token, provide a structured output in JSON format with the following details:
  
  - coin: The name (and symbol, if available) of the cryptocurrency.
  - sentiment: The overall sentiment expressed about the coin (bullish, bearish, or neutral).
  - marketContext: A brief summary of the overall market conditions or context mentioned.
  - tradeSetups: An array of trade setups suggested for that coin. Each trade setup should include:
      - position: The recommended position (Valid values are "long" or "short", otherwise don't return the coin in trade_setups).
      - entryTriggers: Detailed entry triggers, criteria or conditions required to enter the trade. This may be a price level, a technical indicator, or a combination of both.
      - entryPrice: The price at which to enter the trade.
      - timeframe: The timeframe associated with the trade setup. Valid values are "m5", "m15", "m30", "h1", "h4", "h8", "h12", "d1", "d2", "d3", "w", "m", "y".
      - takeProfit: The target price or condition for taking profit.
      - t1: The first target price or condition for taking profit if mentioned.
      - t2: The second target price or condition for taking profit if mentioned.
      - t3: The third target price or condition for taking profit if mentioned.
      - invalidation: Conditions under which the trade setup would be invalidated
      - stopLoss: The stop loss level or condition. Could also be candle close above / below a price level.
      - stopLossPrice: Price to use for stop loss when creating the trade if mentioned.
      - confidenceLevel: Any qualifiers or hedging language mentioned.
      - transcriptExcerpt: A short excerpt supporting this setup.
  
  Additional Instructions:
  
  - Extraction Focus:
      - Identify and extract every crypto coin/token mentioned (e.g., BTC, ETH, LTC, etc.).
      - For each coin, capture every distinct trade idea or setup discussed—even if multiple setups are mentioned for the same coin.
  - Information Details:
      - Capture specific price triggers, technical indicator references (like RSI, moving averages, divergences), and key support/resistance levels.
      - Include any relevant timeframes or contextual comments that influence the trade idea.
  - Filtering:
      - Ignore off-topic commentary, general market chatter, or non-trading-related discussions.
  - Output Format:
      - Please present your final output in a clean, structured JSON format that follows the example below.
  - generalMarketContext 
      - Brief overall summary of market conditions
      - Exclude casual chitchat like "Hey guys, so today we're going to talk about a few different coins."
  
  Example Output:
  {
    generalMarketContext: "Potential short squeeze with resistance around 99k.",
    coins: [
      {
          "coin": "BTC",
          "sentiment": "bullish",
          "marketContext": "Potential short squeeze with resistance around 99k.",
          "tradeSetups": [
              {
                  "position": "long",
                  "entryTriggers": "Price breaking above 99k accompanied by RSI momentum, Confirmation on 12-hour chart with a close above 100k",
                  "entryPrice": "99100",
                  "timeframe": "12-hour",
                  "takeProfit": "Target around 105k",
                  "t1": "105000",
                  "t2": "110000",
                  "t3": "115000",
                  "stopLoss": "Below 98k",
                  "stopLossPrice": 98000,
                  "invalidation": "If RSI drops significantly or a candle closes below 98. h12 close below 98000",
                  "confidenceLevel": "cautiously optimistic",
                  "transcriptExcerpt": "BTC is still facing a challenge around 99k..."
              }
          ]
      }
    ]
  }
  
  Remember: Output only the JSON.
  
  Transcript:`,
  
    'basic': `Please provide a concise summary of the following transcript in markdown format:
  
  1. First, give me a 3-line overview that captures the main essence of the content.
  2. Then, list 3-5 key bullet points highlighting the most important specific information or takeaways.
  
  Keep the summary clear and focused, avoiding any unnecessary details.

  Example Output:
  ### Overview
  The transcript covers crypto market analysis, focusing on Bitcoin's recent price action and potential trade setups. The speaker discusses market sentiment, technical indicators, and specific entry/exit points. Several altcoins are analyzed with detailed trade recommendations.

  ### Key Takeaways
  * **Market Sentiment**: Recent times have been tough, with significant losses across the crypto space. However, several indicators suggest we might have hit bottom.

  * **Bitcoin Analysis**: Currently bullish on Bitcoin, with key support at $45k. Technical indicators suggest potential for upward movement, particularly if $48k resistance is broken.

  * **Altcoin Insights**: Detailed trade setups provided for ETH, SOL, and others. Focus on utility-driven projects rather than meme coins.

  * **Trading Strategy**: Emphasis on risk management and position sizing. Recommends scaling into positions and having clear exit strategies.

  Remember: Output only the markdown formatted text.

  Transcript:`,
  
    'description': `You are a crypto trading analyst expert. Below is a transcript of a crypto trading video that you created. Please extract and structure the information using markdown formatting. The transcript includes timestamps that you should use to create clickable links to the video sections.

  IMPORTANT: The transcript is provided with timestamps in the format "(123.45) Some text here". You MUST use these exact timestamps from the transcript to create your section links. DO NOT use arbitrary timestamps. Each section should use the timestamp of the first relevant mention of that topic in the transcript.
  
  1. Start with a "MARKET CONTEXT" section that captures the overall market sentiment and conditions discussed.
  Use the timestamp of the first market context discussion from the transcript.
  
  2. For each market ticker discussed (cryptocurrency, stock, index, etc.), create a section with:
     - The coin/token symbol in caps followed by a timestamp link (e.g., "BTC", "ETH")
     - Crypto Currencies may be one of those in this list or beyond - SPX, COIN,ARC, FARTCOIN, BONK, WIF, AVAAI, IREN, GOLD, PLTR, BONKGUY, ZEREBRO, MSTR, BERA, NVDA, ETHBTC, SOLBTC, etc.
     - Format must be exactly: #### SYMBOL ([MM:SS]({{VIDEO_URL}}&t=N)) where:
       * SYMBOL is the coin symbol (e.g., BTC, ETH)
       * MM:SS is the minutes:seconds format of the timestamp
       * N is the exact number of seconds from the transcript
     Example: If BTC is first mentioned at timestamp (123.45), write exactly:
     #### BTC ([02:03]({{VIDEO_URL}}&t=123))
     - The key price levels discussed (support, resistance, targets)
     - The trading setup or analysis provided
     - The trader's sentiment (bullish, bearish, neutral)
     - Specific trade recommendations if given (entry, exit, stop loss)
  
  3. Include relevant "MEMBER QUESTION" sections when they provide valuable trading insights or market wisdom.
     Use the exact timestamp when the question is asked in the transcript.
      - Member questions timestamp link (e.g., "BTC", "ETH")
     - Format must be exactly: ######## Member Question ([MM:SS]({{VIDEO_URL}}&t=N)) where:
       * MM:SS is the minutes:seconds format of the timestamp
       * N is the exact number of seconds from the transcript
     Example:  
     #### Member Question [02:03]({{VIDEO_URL}}&t=123)

  Rules:
  - ALWAYS format section headers exactly as shown in the example
  - DO NOT add extra text in the timestamp links
  - DO NOT modify the link format
  - ALWAYS use the exact timestamps from the provided transcript - DO NOT make up timestamps
  - Each section MUST use the timestamp of when that topic is first mentioned in the transcript
  - Focus only on actionable trading information and meaningful market insights
  - Skip casual conversation and non-trading related content
  - Use clear, concise language
  - Maintain chronological order from the stream
  - For each section, note key price levels and specific trade setups when mentioned
  - Include exact quotes when they provide important context or insight
  - Add timestamp links at the start of each major section using the exact seconds from the transcript

  Format each section exactly like this:

  ### MARKET CONTEXT
  [MM:SS]({{VIDEO_URL}}&t=N)
  [Content here]

  ### COIN ANALYSIS
  #### BTC ([MM:SS]({{VIDEO_URL}}&t=N))
  [Analysis here]

  ### MEMBER QUESTIONS
  #### [Question] ([10:15]({{VIDEO_URL}}&t=615))
  [Question and response if trading relevant]

  Rules:
  - Use markdown headers (##, ###) for sections
  - Use bullet points (*) for lists
  - Use **bold** for emphasis on important points
  - Use *italic* for secondary emphasis
  - Format price levels and numbers with code blocks where appropriate
  - Focus only on actionable trading information
  - Skip casual conversation
  - Maintain chronological order
  - Format timestamps as MM:SS in the display text
  - Use the exact seconds from the transcript in the URL
  - Make timestamps clickable links to the video section

  The transcript includes timestamps in the format "(seconds) text", for example:
  "(66.64) What about Bitcoin? (69.18) Let's look at the chart"
  You MUST use these exact timestamps (converting to MM:SS format for display) when creating your sections.

  VIDEO_URL: {{VIDEO_URL}}
  VIDEO_ID: {{VIDEO_ID}}
  
  Transcript:{{TRANSCRIPT_WITH_SECONDS}}
  `,
  'multiFirst': `Below is a transcript of a crypto trading video. Your task is to scan the transcript and create a structured outline that identifies high-level topics, key segments, and timestamps with clickable links. Use the following guidelines:

1. **Topics to Identify:**
   - Intro / Overview
   - Individual market ticker discussions (e.g., cryptocurrencies, stocks, indices)
   - Educational content
   - Member questions
   - Other significant topics or segments

2. **Ticker Identification:**
   Use this list of example tickers to help you flag segments discussing these or similar instruments: 
   SPX, COIN, ARC, FARTCOIN, BONK, WIF, AVAAI, IREN, GOLD, PLTR, BONKGUY, ZEREBRO, MSTR, BERA, NVDA, ETHBTC, SOLBTC, etc.

3. **Formatting Requirements:**
   - For each segment, extract the topic name, the exact timestamp (displayed in MM:SS format), and a clickable link in the following format:  
     [MM:SS]({{VIDEO_URL}}&t=N)
   - Organize the outline in a structured markdown format
   - Do not include any full analysis or detailed trade setups at this stage

**Example Output Format:**

### MARKET OVERVIEW
[01:48]({{VIDEO_URL}}&t=108)
- Key topics covered: Market sentiment, overall trends
- Tickers mentioned: [BTC, ETH]

### COIN ANALYSIS
#### BTC
[02:05]({{VIDEO_URL}}&t=125)
- Discussion points: Price levels, trend analysis
- Related tickers: [ETHBTC]

### MEMBER QUESTIONS
[04:58]({{VIDEO_URL}}&t=298)
- Topic: Daily Close & Market Structure
- Tickers discussed: [BTC, ETH]

Now, please output only the structured outline in markdown format based on the provided transcript.`,
  'multiSecond': `Enrich this outline with detailed trading analysis. For each segment:

  1. Keep existing timestamps and structure
  2. Add for each ticker:
     - Key price levels
     - Trading setup details
     - Sentiment (bullish/bearish/neutral)
     - Trade recommendations
  `,
  'multiFirstAlpha': `You are analyzing a crypto trading video transcript. Create a high-level outline with exact timestamps.

  Common tickers to identify: SPX, COIN, ARC, FARTCOIN, BONK, WIF, AVAAI, IREN, GOLD, PLTR, BONKGUY, ZEREBRO, MSTR, BERA, NVDA, ETHBTC, SOLBTC

  For each segment identify exact timestamp from transcript (format: [MM:SS]({{VIDEO_URL}}&t=N))
  and a Brief topic description
  
  **Example Output Format:**
  Format each segment as follows:
  Topic type (Market Overview, Coin Analysis, Member Question, Education)
     For "Market Overview" format as:
       ###  Market Overview ([MM:SS]({{VIDEO_URL}}&t=N))
        - Key points covered
     For "Coin Analysis" format as:
       ### [SYMBOL] ([MM:SS]({{VIDEO_URL}}&t=N))
        - Key points covered
     For "Member Question" format as:
       ### Member Question ([MM:SS]({{VIDEO_URL}}&t=N))
        - Question and response if trading relevant
     For "Education" format as:
       ### Education ([MM:SS]({{VIDEO_URL}}&t=N))
        - Key points covered

  `,

  'multiSecondAlpha': `Enrich this outline with detailed trading analysis. For each segment:

  1. Keep existing timestamps and structure
  2. Add for each ticker:
     - Key price levels
     - Trading setup details
     - Sentiment (bullish/bearish/neutral)
     - Trade recommendations
  
  Maintain exact timestamp links: [MM:SS]({{VIDEO_URL}}&t=N)`
} as const;

const getPrompt = (summaryType: string): string => {
  return summaryType in prompts ? prompts[summaryType as keyof typeof prompts] : prompts.basic;
};

// Add proper typing for OpenAI API response
type OpenAIResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

type PipelineContext = {
  transcription: string;
  videoUrl: string;
  captions?: {text: string, startSeconds: number, endSeconds: number}[];
  outline?: string;
  result?: string;
};

class Pipeline {
  private steps: ((context: PipelineContext) => Promise<PipelineContext>)[] = [];

  addStep(step: (context: PipelineContext) => Promise<PipelineContext>) {
    this.steps.push(step);
    return this;
  }

  async execute(initialContext: PipelineContext): Promise<PipelineContext> {
    return this.steps.reduce(
      async (contextPromise, step) => step(await contextPromise),
      Promise.resolve(initialContext)
    );
  }
}

async function generateOutline(context: PipelineContext): Promise<PipelineContext> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: prompts.multiFirst.replace(/\{\{VIDEO_URL\}\}/g, context.videoUrl)
        },
        {
          role: "user",
          content: context.transcription
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "text" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return {
    ...context,
    outline: data.choices[0]?.message?.content ?? ''
  };
}

async function enrichOutline(context: PipelineContext): Promise<PipelineContext> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: prompts.multiSecond.replace(/\{\{VIDEO_URL\}\}/g, context.videoUrl)
        },
        {
          role: "user",
          content: context.outline
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "text" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return {
    ...context,
    result: data.choices[0]?.message?.content
  };
}

async function multiPass(
  transcription: string,
  videoUrl: string,
  captions?: {text: string, startSeconds: number, endSeconds: number}[]
): Promise<string> {
  const pipeline = new Pipeline();
  
  pipeline
    .addStep(generateOutline)
    .addStep(enrichOutline);

  const result = await pipeline.execute({
    transcription,
    videoUrl,
    captions
  });

  return result.result ?? '';
}

// Define a common interface for all summarization strategies
interface SummarizationStrategy {
  summarize(
    transcription: string,
    captions?: { text: string; startSeconds: number; endSeconds: number }[],
    videoUrl?: string
  ): Promise<string | TranscriptionSetups>;
}

// Implement specific strategies
class DescriptionSummarizer implements SummarizationStrategy {
  async summarize(transcription: string, captions?: Caption[], videoUrl?: string): Promise<string> {
    if (!captions?.length || !videoUrl) {
      throw new Error('Captions and videoUrl are required for description summary');
    }
    return await multiPass(transcription, videoUrl, captions);
  }
}

// class TradeSetupsSummarizer implements SummarizationStrategy {
//   async summarize(transcription: string): Promise<TranscriptionSetups> {
//     // ... implementation for trade setups
//     const response = await this.callOpenAI(transcription, 'json_object');
//     return JSON.parse(response) as TranscriptionSetups;
//   }
// }

class BasicSummarizer implements SummarizationStrategy {
  async summarize(transcription: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a crypto trading analysis assistant that extracts structured trade ideas from video transcripts."
          },
          {
            role: "user",
            content: `${getPrompt('basic')}${transcription}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "text" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.status}`);
    }

    const data = await response.json() as OpenAIResponse;
    return data.choices[0]?.message?.content ?? '';
  }
}

// Factory to get the appropriate strategy
const getSummarizationStrategy = (summaryType: string): SummarizationStrategy => {
  switch (summaryType) {
    case 'description':
      return new DescriptionSummarizer();
    // case 'trade-setups':
    //   return new TradeSetupsSummarizer();
    default:
      return new BasicSummarizer();
  }
};

// Simplified main function
export async function summarizeTranscription(
  transcription: string,
  summaryType: string,
  captions?: { text: string; startSeconds: number; endSeconds: number }[],
  videoUrl?: string
): Promise<string | TranscriptionSetups> {
  const strategy = getSummarizationStrategy(summaryType);
  return await strategy.summarize(transcription, captions, videoUrl);
}

export async function getSetups(
  transcription: string, 
  summaryType: string
): Promise<TranscriptionSetups> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY ?? ''}`
        },
        body: JSON.stringify({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: "You are a crypto trading analysis assistant that extracts structured trade ideas from video transcripts. You focus on identifying specific trade setups, entry/exit points, and market context for each cryptocurrency mentioned."
                },
                {
                    role: "user",
                    content: `${getPrompt(summaryType)}${transcription}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1500,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = JSON.parse(data.choices[0]?.message?.content ?? '{}') as TranscriptionSetups;
    
    if (!content.generalMarketContext || !Array.isArray(content.coins)) {
        throw new Error('Invalid response format from OpenAI');
    }

    return content;
}

export async function summarizeAndSaveSummary(
  videoId: string,
  transcription: string,
  summaryType: string,
  captions?: { text: string; startSeconds: number; endSeconds: number }[],
  videoUrl?: string
): Promise<string> {
  const summary = await summarizeTranscription(transcription, summaryType, captions, videoUrl);
  const content = typeof summary === 'string' ? summary : JSON.stringify(summary);
  const repository = new VideoRepository(db);

  if (content) {
    await repository.saveSummary(videoId, content, summaryType);
  }

  return content;
}

export async function describeAndSave(
  transcription: string,
  summaryType: string,
  captions?: { text: string; startSeconds: number; endSeconds: number }[],
  videoUrl?: string
): Promise<string> {
  const summary = await summarizeTranscription(transcription, summaryType, captions, videoUrl);
  const content = typeof summary === 'string' ? summary : JSON.stringify(summary);
  const repository = new VideoRepository(db);

  if (content) {
    await repository.saveSummary(undefined, content, summaryType, videoUrl);
  }

  return content;
}

export class VideoService {
  private repository: VideoRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new VideoRepository(prisma);
  }

  async summarizeAndSave(videoId: string, transcription: string, summaryType: string): Promise<unknown> {
    try {
      const summary = await summarizeTranscription(transcription, summaryType);
      const summaryContent = typeof summary === 'string' ? summary : JSON.stringify(summary);
      
      return await this.repository.updateVideoContent(videoId, {
        summary: summaryType === 'basic' ? summaryContent : undefined,
        description: summaryType === 'description' ? summaryContent : undefined,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to summarize and save: ${error.message}`);
      }
      throw new Error('Failed to summarize and save: Unknown error');
    }
  }

  async createVideo(data: VideoCreateInput) {
    // First, check if a video with this URL already exists
    const existingVideo = await this.repository.getVideoByUrl(data.videoUrl);
    console.log("createVideo: existingVideo is ", existingVideo?.videoUrl)
    
    if (existingVideo) {
      // Check if the user-video relation already exists
      const existingUserVideo = await this.repository.getUserVideo(data.userId, existingVideo.id);

      // Only create the relation if it doesn't exist
      if (!existingUserVideo) {
        await this.repository.createUserVideo(data.userId, existingVideo.id);
      }
      return existingVideo;
    }

    // If video doesn't exist, create it and the UserVideo relation
    return await this.repository.createVideo(data);
  }

  async updateVideo(id: string, data: VideoUpdateInput) {
    return this.repository.updateVideo(id, data);
  }

  async getVideo(id: string) {
    return await this.repository.getVideo(id);
  }

  async getVideoBySlug(slug: string) {
    return await this.repository.getVideoBySlug(slug);
  }

  async getVideos() {
    return await this.repository.getVideos();
  }

  async deleteVideo(id: string) {
    return await this.repository.deleteVideo(id);
  }
}
