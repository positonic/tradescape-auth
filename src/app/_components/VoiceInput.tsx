'use client';

import { useState, useEffect, useRef } from 'react';
import { ActionIcon, Box, Paper, Text, Transition, Switch, Tooltip } from '@mantine/core';
import { IconMicrophone, IconWaveSine } from '@tabler/icons-react';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceInputProps {
  onTranscriptionComplete: (text: string) => void;
  isProcessing: boolean;
}

export function VoiceInput({ onTranscriptionComplete, isProcessing }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('A. Starting recording process');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('X. Recording stopped');
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          if (base64Audio) {
            onTranscriptionComplete(base64Audio);
          }
        };
      };

      setIsRecording(true);
      mediaRecorder.start();
      
    } catch (err) {
      console.error('Error in startRecording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  return (
    <Box pos="relative">
      <Paper shadow="md" p="xs" radius="lg" style={{ backgroundColor: '#f8f9fa' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Tooltip 
            label={isRecording ? "Click to stop recording" : "Click to start recording"}
            position="top"
          >
            <ActionIcon
              size="xl"
              radius="xl"
              variant={isRecording ? "filled" : "light"}
              color={isRecording ? "red" : "blue"}
              onClick={isRecording ? stopRecording : startRecording}
              loading={isProcessing}
              style={{
                transition: 'all 0.2s ease',
                transform: isRecording ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {isRecording ? (
                <IconWaveSine size={24} style={{ animation: 'pulse 1s infinite' }} />
              ) : (
                <IconMicrophone size={24} />
              )}
            </ActionIcon>
          </Tooltip>

          <Box style={{ width: '180px', height: '24px', marginTop: '4px' }}>
            {isRecording && (
              <AudioVisualizer
                width={180}
                height={24}
                gradientColors={['#e7f5ff', '#228be6']}
                barWidth={2}
                barSpacing={1}
                minDecibels={-75}
                maxDecibels={-30}
                smoothingTimeConstant={0.6}
                fftSize={512}
              />
            )}
          </Box>

          <Switch
            label="Enable voice responses"
            checked={audioEnabled}
            onChange={(event) => setAudioEnabled(event.currentTarget.checked)}
            size="md"
          />
        </Box>

        <style jsx global>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>

        <Transition
          mounted={isProcessing}
          transition="fade"
          duration={400}
        >
          {(styles) => (
            <Text 
              size="sm" 
              c="dimmed" 
              mt="xs" 
              style={styles}
            >
              Processing your voice input...
            </Text>
          )}
        </Transition>
      </Paper>
    </Box>
  );
} 