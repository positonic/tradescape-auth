"use client";

import { useState, useEffect, useRef } from "react";
import {
  ActionIcon,
  Box,
  Paper,
  Text,
  Transition,
  Switch,
  Tooltip,
} from "@mantine/core";
import { IconMicrophone, IconWaveSine } from "@tabler/icons-react";
import { AudioVisualizer } from "./AudioVisualizer";

interface VoiceInputProps {
  onTranscriptionComplete: (text: string) => void;
  isProcessing: boolean;
  onAudioEnabled?: (enabled: boolean) => void;
}

export function VoiceInput({
  onTranscriptionComplete,
  isProcessing,
  onAudioEnabled,
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Notify parent component when audio is enabled/disabled
  useEffect(() => {
    onAudioEnabled?.(audioEnabled);
  }, [audioEnabled, onAudioEnabled]);

  useEffect(() => {
    return () => {
      console.log('🎤 Cleanup: Component unmounting');
      // Cleanup function that runs when component unmounts
      if (mediaRecorderRef.current) {
        console.log('🎤 Cleanup: Stopping media recorder');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        console.log('🎤 Cleanup: Media recorder nulled');
      }
      if (chunksRef.current) {
        console.log('🎤 Cleanup: Clearing chunks');
        chunksRef.current = [];
      }
      if (streamRef.current) {
        console.log('🎤 Cleanup: Found active stream, cleaning up tracks');
        const tracks = streamRef.current.getTracks();
        console.log(`🎤 Cleanup: Found ${tracks.length} tracks to clean up`);
        tracks.forEach((track, index) => {
          console.log(`🎤 Cleanup: Stopping track ${index}, kind: ${track.kind}, state: ${track.readyState}`);
          track.stop();
          track.enabled = false;
          console.log(`🎤 Cleanup: Track ${index} stopped and disabled`);
        });
        streamRef.current = null;
        console.log('🎤 Cleanup: Stream reference nulled');
      } else {
        console.log('🎤 Cleanup: No active stream found');
      }
      console.log('🎤 Cleanup: Complete');
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎤 Start: Beginning recording process');
      // Stop any existing streams first
      if (streamRef.current) {
        console.log('🎤 Start: Found existing stream, cleaning up first');
        const tracks = streamRef.current.getTracks();
        console.log(`🎤 Start: Found ${tracks.length} existing tracks to clean up`);
        tracks.forEach((track, index) => {
          console.log(`🎤 Start: Stopping existing track ${index}, kind: ${track.kind}, state: ${track.readyState}`);
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
        console.log('🎤 Start: Existing stream cleaned up');
      }
      
      console.log('🎤 Start: Requesting media stream');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎤 Start: Media stream obtained');
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      console.log('🎤 Start: MediaRecorder created and initialized');

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log('🎤 Data: Chunk received', e.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 Stop: MediaRecorder stopped event triggered');
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        console.log('🎤 Stop: Audio blob created', audioBlob.size);
        
        // Ensure stream cleanup
        if (streamRef.current) {
          console.log('🎤 Stop: Cleaning up stream in onstop');
          const tracks = streamRef.current.getTracks();
          console.log(`🎤 Stop: Found ${tracks.length} tracks to clean up in onstop`);
          tracks.forEach((track, index) => {
            console.log(`🎤 Stop: Stopping track ${index}, kind: ${track.kind}, state: ${track.readyState}`);
            track.stop();
            track.enabled = false;
            console.log(`🎤 Stop: Track ${index} stopped and disabled`);
          });
          streamRef.current = null;
          console.log('🎤 Stop: Stream cleanup complete in onstop');
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          console.log('🎤 Stop: Audio data processed');
          if (reader.result && typeof reader.result === "string") {
            const base64Audio = reader.result.split(",")[1];
            if (base64Audio) {
              console.log('🎤 Stop: Sending audio for transcription');
              onTranscriptionComplete(base64Audio);
            }
          }
        };
      };

      setIsRecording(true);
      mediaRecorder.start();
      console.log('🎤 Start: Recording started');
    } catch (err) {
      console.error('🎤 Error: Recording failed:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    console.log('🎤 Stop: Manual stop recording triggered');
    if (mediaRecorderRef.current && isRecording) {
      console.log('🎤 Stop: Stopping media recorder');
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log('🎤 Stop: Media recorder nulled');

      if (streamRef.current) {
        console.log('🎤 Stop: Found active stream to clean up');
        const tracks = streamRef.current.getTracks();
        console.log(`🎤 Stop: Found ${tracks.length} tracks to clean up`);
        tracks.forEach((track, index) => {
          console.log(`🎤 Stop: Stopping track ${index}, kind: ${track.kind}, state: ${track.readyState}`);
          track.stop();
          track.enabled = false;
          console.log(`🎤 Stop: Track ${index} stopped and disabled`);
        });
        streamRef.current = null;
        console.log('🎤 Stop: Stream cleanup complete');
      }

      if (chunksRef.current) {
        console.log('🎤 Stop: Clearing chunks');
        chunksRef.current = [];
      }

      setIsRecording(false);
      console.log('🎤 Stop: Recording stopped completely');
    } else {
      console.log('🎤 Stop: No active recording to stop');
    }
  };

  return (
    <Box pos="relative">
      <Paper
        shadow="md"
        p="xs"
        radius="lg"
        style={{ backgroundColor: "#f8f9fa" }}
      >
        <Box style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Text size="sm" c="dimmed" mb="xs">
            Click the microphone icon to start recording your voice, then click again to stop.
          </Text>
          
          <Box style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Tooltip
              label={
                isRecording
                  ? "Click to finish recording"
                  : "Click to start recording your voice message"
              }
              position="top"
              maw={200}
            >
              <ActionIcon
                size="xl"
                radius="xl"
                variant={isRecording ? "filled" : "light"}
                color={isRecording ? "red" : "blue"}
                onClick={isRecording ? stopRecording : startRecording}
                loading={isProcessing}
                style={{
                  transition: "all 0.2s ease",
                  transform: isRecording ? "scale(1.1)" : "scale(1)",
                }}
              >
                {isRecording ? (
                  <Box style={{ position: 'relative' }}>
                    <IconWaveSine
                      size={24}
                      style={{ animation: "pulse 1s infinite" }}
                    />
                    <Text size="xs" style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                      Recording...
                    </Text>
                  </Box>
                ) : (
                  <IconMicrophone size={24} />
                )}
              </ActionIcon>
            </Tooltip>

            <Box style={{ width: "180px", height: "24px", marginTop: "4px" }}>
              {isRecording && streamRef.current && (
                <AudioVisualizer
                  width={180}
                  height={24}
                  gradientColors={["#e7f5ff", "#228be6"]}
                  barWidth={2}
                  barSpacing={1}
                  minDecibels={-75}
                  maxDecibels={-30}
                  smoothingTimeConstant={0.6}
                  fftSize={512}
                  stream={streamRef.current}
                />
              )}
            </Box>

            <Tooltip
              label="When enabled, AI will respond to you with voice"
              position="top"
              maw={200}
            >
              <Switch
                label="Enable voice responses"
                checked={audioEnabled}
                onChange={(event) => setAudioEnabled(event.currentTarget.checked)}
                size="md"
                description="AI will respond with voice"
              />
            </Tooltip>
          </Box>
        </Box>

        <style jsx global>{`
          @keyframes pulse {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
            100% {
              opacity: 1;
            }
          }
        `}</style>

        <Transition mounted={isProcessing} transition="fade" duration={400}>
          {(styles) => (
            <Text size="sm" c="dimmed" mt="xs" style={styles}>
              Processing your voice input...
            </Text>
          )}
        </Transition>
      </Paper>
    </Box>
  );
}
