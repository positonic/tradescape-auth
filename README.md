# Video Transcription & Analysis Platform

A modern web application for transcribing, analyzing, and searching through video content, built with the T3 Stack.

## 🌟 Features

- **Video Processing**
  - YouTube video URL support
  - Automatic transcription generation
  - Semantic search through video content
  - Real-time processing status tracking

- **AI-Powered Chat Interface**
  - Interactive chat with AI assistant
  - Video content analysis
  - Natural language video search
  - Tool-based interaction system

- **Authentication**
  - Discord OAuth integration
  - Protected routes and API endpoints
  - Session management

- **Advanced Search**
  - Vector-based semantic search (pgvector)
  - Chunk-based video content indexing
  - Similarity scoring

## 🛠 Tech Stack

- **Frontend**
  - Next.js 15
  - React 18
  - Mantine UI
  - TailwindCSS
  - TypeScript

- **Backend**
  - tRPC
  - Prisma
  - PostgreSQL with pgvector
  - NextAuth.js
  - LangChain

- **AI/ML**
  - OpenAI embeddings
  - LangChain integration
  - Vector similarity search

## 🚀 Getting Started

1. **Clone the repository**

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Position Aggregation

The trading platform includes an advanced position aggregation system that converts individual orders into meaningful trading positions using semantic direction fields.

### Business Rules

#### Position Detection Strategy: `positionByDirection`

The system uses a semantic direction-based approach for position creation:

1. **Order Processing**
   - Orders are sorted chronologically (oldest first)
   - Direction field values determine position boundaries
   - Separate state machines track long and short positions

2. **Position Opening**
   - `"Open Long"` - Starts new long position or adds to existing open long
   - `"Open Short"` - Starts new short position or adds to existing open short
   - `"Add Long"` - Adds to existing open long position
   - `"Add Short"` - Adds to existing open short position

3. **Position Closing**
   - `"Close Long"` - Closes current long position (creates completed position)
   - `"Close Short"` - Closes current short position (creates completed position)
   - Orphaned close orders (without matching open) are ignored

4. **Position Size Calculation**
   - Tracks maximum position size reached during lifecycle
   - For long positions: buys increase size, sells decrease size
   - For short positions: sells increase size, buys decrease size
   - Returns the peak position size, not cumulative volume

5. **Position Types**
   - **Complete Positions**: Have both opening and closing orders
   - **Open Positions**: Still active (no closing order yet)
   - **Direction-based Classification**: Uses semantic fields over order types

#### Example Position Lifecycle

```
Order 1: "Open Long" 28.4 USDC     → Position opens (size: 28.4)
Order 2: "Add Long" 56.8 USDC      → Position grows (size: 85.2)
Order 3: "Close Long" 85.2 USDC    → Position closes (max size: 85.2)
```

#### Configuration

- **Strategy**: `positionByDirection` (semantic-based)
- **Minimum Orders**: 1 order per position
- **Partial Positions**: Allowed (open positions without closes)
- **Volume Threshold**: Not applicable (direction-based logic)

#### Integration Points

- **Manual Creation**: "Create Positions" button uses this strategy
- **Automatic Creation**: Trade sync automatically creates positions
- **API Endpoints**: `createPositionsFromExistingOrders` and `syncTrades`

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
