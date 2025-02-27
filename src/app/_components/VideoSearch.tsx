'use client';

import { useState } from 'react';
import { api } from "~/trpc/react";
import { TextInput, Button, Paper, Text, Stack, Group, Badge } from '@mantine/core';

interface SearchResult {
  videoId: string;
  chunkStart: number;
  chunkText: string;
  similarity: number;
  slug: string;
}

export default function VideoSearch() {
  const [query, setQuery] = useState('');
  
  const search = api.video.search.useQuery<{ results: SearchResult[] }>(
    { query, limit: 5 },
    { 
      enabled: false, // Don't run automatically
      retry: false 
    }
  );

  const handleSearch = () => {
    if (query) {
      void search.refetch();
    }
  };

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search video content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button
          onClick={handleSearch}
          loading={search.isFetching}
        >
          Search
        </Button>
      </Group>

      <Stack gap="md">
        {search.data?.results && (
          <Text size="sm" c="dimmed">
            Found {search.data.results.length} results
          </Text>
        )}
        {search.data?.results.map((result) => (
          <Paper key={`${result.videoId}-${result.chunkStart}`} p="md" withBorder>
            <Stack gap="xs">
              <Badge variant="light" color="blue">
                Similarity: {(result.similarity * 100).toFixed(2)}%
              </Badge>
              <Text>
                {result.chunkText.split(new RegExp(`(${query})`, 'gi')).map((part, i) => 
                  part.toLowerCase() === query.toLowerCase() ? (
                    <Text component="span" fw={700} key={i}>{part}</Text>
                  ) : part
                )}
              </Text>
              <Text
                component="a"
                href={`https://www.youtube.com/watch?v=${result.slug}&t=${Math.floor(result.chunkStart)}`}
                target="_blank"
                rel="noopener noreferrer"
                c="blue"
                style={{ textDecoration: 'none' }}
                fw={500}
              >
                View on YouTube
              </Text>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {search.error && (
        <Text c="red">{search.error.message}</Text>
      )}
    </Stack>
  );
}