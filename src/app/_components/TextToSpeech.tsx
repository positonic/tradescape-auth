'use client';

import { Button } from '@mantine/core';
import { IconVolume } from '@tabler/icons-react';
import { ElevenLabsClient } from "elevenlabs";
import { useState } from 'react';
import { notifications } from '@mantine/notifications';

interface TextToSpeechProps {
  text: string;
}

export function TextToSpeech({ text }: TextToSpeechProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    let apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      notifications.show({
        title: 'Configuration Error',
        message: 'ElevenLabs API key is not configured',
        color: 'red',
      });
      return;
    }

    // Remove 'sk_' prefix if present
    apiKey = apiKey.replace('sk_', '');

    try {
      setIsPlaying(true);
      
      // Make a direct API call to ElevenLabs
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `ElevenLabs API error: ${response.status}${errorData ? ' - ' + JSON.stringify(errorData) : ''}`
        );
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // Create and play audio
      const audioElement = new Audio(url);
      audioElement.addEventListener('ended', () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url); // Clean up the blob URL
      });

      audioElement.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      });
      
      await audioElement.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to play audio',
        color: 'red',
      });
      setIsPlaying(false);
    }
  };

  return (
    <Button
      onClick={handlePlay}
      loading={isPlaying}
      leftSection={<IconVolume size={16} />}
      variant="light"
      size="xs"
    >
      Listen
    </Button>
  );
} 