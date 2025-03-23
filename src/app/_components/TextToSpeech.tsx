'use client';

import { Button } from '@mantine/core';
import { IconVolume } from '@tabler/icons-react';
import { useState } from 'react';
import { speakText } from './utils/tts';

interface TextToSpeechProps {
  text: string;
}

export function TextToSpeech({ text }: TextToSpeechProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    try {
      setIsPlaying(true);
      await speakText(text);
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
      size="xs"
    >
      Listen
    </Button>
  );
} 