'use client';

import { useState } from 'react';
import { api } from "~/trpc/react";

export default function VideoSearch() {
  const [query, setQuery] = useState('');
  
  const search = api.video.search.useQuery(
    { query, limit: 5 },
    { 
      enabled: false, // Don't run automatically
      retry: false 
    }
  );

  const handleSearch = () => {
    if (query) {
      search.refetch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="Search video content..."
        />
        <button
          onClick={handleSearch}
          disabled={search.isFetching}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {search.isFetching ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="space-y-4">
        {search.data?.results.map((result: any) => (
          <div key={`${result.videoId}-${result.chunkStart}`} className="p-4 border rounded">
            <p className="text-sm text-gray-500">
              Similarity: {(result.similarity * 100).toFixed(2)}%
            </p>
            <p>{result.chunkText}</p>
            <a 
              href={`https://www.youtube.com/watch?v=${result.slug}&t=${Math.floor(result.chunkStart)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View on YouTube
            </a>
          </div>
        ))}
      </div>

      {search.error && (
        <p className="text-red-500">Error: {search.error.message}</p>
      )}
    </div>
  );
}