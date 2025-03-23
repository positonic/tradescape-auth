'use client';

import { Button } from '@mantine/core';
import { IconVolume } from '@tabler/icons-react';
import { ElevenLabsClient, play } from "elevenlabs";
import { useState } from 'react';

interface TextToSpeechProps {
  text: string;
}

export function TextToSpeech({ text }: TextToSpeechProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    try {
      setIsPlaying(true);
      const client = new ElevenLabsClient({
        apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      });

      const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
        text,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
      });

      await play(audio);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <Button
      onClick={handlePlay}
      loading={isPlaying}
      leftSection={<IconVolume size={16} />}
      variant="light"
      size="sm"
    >
      Listen
    </Button>
  );
} 