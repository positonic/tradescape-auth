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
import { api } from "~/trpc/react";

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
  const [transcribedText, setTranscribedText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const transcribeAudio = api.tools.transcribeFox.useMutation();
  const silenceCheckIdRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Threshold values for silence detection
  const SILENCE_THRESHOLD = -45; // dB (less negative = more sensitive)
  const SILENCE_DURATION = 1000; // ms (shorter time before processing)
  const MIN_RECORDING_LENGTH = 1500; // ms
  const MAX_CHUNK_DURATION = 10000; // 10 seconds max chunk size

  // Notify parent component when audio is enabled/disabled
  useEffect(() => {
    onAudioEnabled?.(audioEnabled);
  }, [audioEnabled, onAudioEnabled]);

  // Cleanup resources
  useEffect(() => {
    return () => {
      console.log('🎤 Cleanup: Component unmounting');
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
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
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    silenceStartRef.current = null;
    
    // Cancel the animation frame if it exists
    if (silenceCheckIdRef.current !== null) {
      console.log('🎤 Cleanup: Cancelling silence check animation frame');
      cancelAnimationFrame(silenceCheckIdRef.current);
      silenceCheckIdRef.current = null;
    }

    // Clear the processing timer if it exists
    if (processingTimerRef.current) {
      console.log('🎤 Cleanup: Clearing forced processing timer');
      clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  };

  const processAudioChunk = async () => {
    if (chunksRef.current.length === 0) {
      console.log('🎤 Process: No chunks to process');
      return;
    }
    
    console.log('🎤 Process: Processing audio chunk with', chunksRef.current.length, 'chunks');
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 1000) {
      console.log('🎤 Process: Skipping processing, too soon since last processing');
      return;
    }
    
    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    console.log('🎤 Process: Audio blob created', audioBlob.size, 'bytes');
    
    // Create a copy of chunks and then clear the original for the next segment
    const chunksToProcess = [...chunksRef.current];
    chunksRef.current = [];
    lastProcessTimeRef.current = now;
    
    // Skip tiny audio clips
    if (audioBlob.size < 1000) {
      console.log('🎤 Process: Audio clip too small, skipping');
      return;
    }
    
    try {
      console.log('🎤 Process: Starting transcription of chunk');
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        if (reader.result && typeof reader.result === "string") {
          const base64Audio = reader.result.split(",")[1];
          if (base64Audio) {
            console.log('🎤 Process: Sending audio for transcription', base64Audio.length, 'chars');
            console.log('🎤 API: About to send transcription request with data length:', base64Audio.length);
            try {
              const result = await transcribeAudio.mutateAsync({ audio: base64Audio });
              console.log('🎤 Process: Transcription result received', result);
              console.log('🎤 API: Raw response from transcribeAudio:', JSON.stringify(result));
              if (result.text) {
                const newText = result.text.trim();
                console.log('🎤 Process: Adding new transcription to UI:', newText);
                setTranscribedText(prev => {
                  const updated = prev + (prev ? " " : "") + newText;
                  console.log('🎤 Process: Updated transcribed text:', updated);
                  return updated;
                });
              } else {
                console.log('🎤 Process: No text in transcription result');
              }
            } catch (error) {
              console.error('🎤 Process: Transcription API error:', error);
            }
          } else {
            console.log('🎤 Process: No base64 audio extracted from blob');
          }
        } else {
          console.log('🎤 Process: FileReader result not available or not a string');
        }
      };
    } catch (error) {
      console.error('🎤 Error: Transcription process failed:', error);
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Start: Beginning recording process');
      cleanupAudioResources();
      setTranscribedText("");
      
      console.log('🎤 Start: Requesting media stream');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎤 Start: Media stream obtained');
      streamRef.current = stream;
      
      // Set up audio context for silence detection
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      analyserRef.current.smoothingTimeConstant = 0.85;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Function to monitor audio levels and detect silence
      const checkSilence = () => {
        // Log the call count and current state
        frameCountRef.current++;
        console.log('�� Silence Check:', {
          frameCount: frameCountRef.current,
          isRecording,
          hasAnalyser: !!analyserRef.current,
          buttonExists: !!document.querySelector('[color="red"]'),
          time: new Date().toISOString()
        });

        if (!analyserRef.current) {
          console.log('🎤 Silence Check: Stopping due to no analyzer');
          return;
        }
        
        // Always keep checking until explicitly told to stop - the recording state
        // might still be updating
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        const average = sum / bufferLength;
        const dB = 20 * Math.log10(average / 255);
        
        // Log audio levels every 10 frames to avoid console flood
        if (frameCountRef.current % 10 === 0) {
          console.log(`🎤 Levels: Frame ${frameCountRef.current}:`, {
            dB: dB.toFixed(2),
            threshold: SILENCE_THRESHOLD,
            silenceStarted: silenceStartRef.current ? new Date(silenceStartRef.current).toISOString() : null
          });
        }
        
        const now = Date.now();
        const recordingDuration = now - lastProcessTimeRef.current;
        
        // If sound is below threshold, mark silence start
        if (dB < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
            console.log('🎤 Silence: Started at', new Date(now).toISOString());
          } else {
            const silenceDuration = now - silenceStartRef.current;
            // Log silence duration every 10 frames
            if (frameCountRef.current % 10 === 0) {
              console.log(`🎤 Silence: Duration ${silenceDuration}ms / ${SILENCE_DURATION}ms needed`);
            }
            
            if (silenceDuration > SILENCE_DURATION && recordingDuration > MIN_RECORDING_LENGTH) {
              console.log(`🎤 Silence: Threshold reached! Processing chunk after ${silenceDuration}ms of silence`);
              processAudioChunk();
              silenceStartRef.current = null;
            }
          }
        } else {
          if (silenceStartRef.current !== null) {
            console.log('🎤 Silence: Broken, resetting silence detection');
            silenceStartRef.current = null;
          }
        }
        
        // Ensure we don't go too long without processing
        if (recordingDuration > MAX_CHUNK_DURATION) {
          console.log(`🎤 Duration: Max chunk duration reached (${MAX_CHUNK_DURATION}ms), processing`);
          processAudioChunk();
        }
        
        // Log before and after requestAnimationFrame call
        console.log('🎤 Silence Check: Before RAF, button color:', document.querySelector('[color="red"]') ? 'red' : 'not red');
        
        // We changed our check here - only look at the DOM element to determine if we should
        // be recording, not the React state which might lag
        if (document.querySelector('[color="red"]')) {
          // Continue silence detection if red record button is visible
          silenceCheckIdRef.current = requestAnimationFrame(checkSilence);
          console.log('🎤 Silence Check: RAF scheduled, ID:', silenceCheckIdRef.current);
        } else {
          console.log('🎤 Silence Check: Stopping because recording button is no longer red');
        }
      };
      
      // Set isRecording to true BEFORE starting silence detection
      setIsRecording(true);
      
      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // or 'audio/wav' if supported
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log(`🎤 Data: Received chunk of ${e.data.size} bytes`);
          chunksRef.current.push(e.data);
          console.log(`🎤 Data: Now have ${chunksRef.current.length} chunks total`);
        } else {
          console.log('🎤 Data: Received empty chunk');
        }
      };
      
      lastProcessTimeRef.current = Date.now();
      mediaRecorder.start(500); // Collect data every 500ms
      console.log('🎤 Start: Recording started');
      
      // Start silence detection with proper ID tracking AFTER setting isRecording = true
      silenceCheckIdRef.current = requestAnimationFrame(checkSilence);
      
      // Add a timer as a fallback to ensure processing occurs
      const processingTimerId = setInterval(() => {
        console.log('🎤 Timer: Forced processing timer fired');
        if (chunksRef.current.length > 0) {
          console.log('🎤 Timer: Found chunks to process, forcing processing');
          processAudioChunk();
        } else {
          console.log('🎤 Timer: No chunks to process');
        }
      }, 3000); // Process every 3 seconds as a fallback
      
      // Store the timer ID for later cleanup
      processingTimerRef.current = processingTimerId;
      
    } catch (err) {
      console.error('🎤 Error: Recording failed:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    console.log('🎤 Stop: Manual stop recording triggered');
    if (isRecording) {
      // Process any remaining audio
      await processAudioChunk();
      
      // Submit the complete transcribed text
      if (transcribedText.trim()) {
        onTranscriptionComplete(transcribedText.trim());
      }
      
      // Clean up resources
      cleanupAudioResources();
      setIsRecording(false);
      console.log('🎤 Stop: Recording stopped completely');
    }
  };
  console.log('🎤 transcribedText!!', transcribedText);
  console.log('🎤 isRecording!!', isRecording);

  // Add this useEffect to track isRecording changes
  useEffect(() => {
    console.log('🎤 State: isRecording changed to', isRecording);
  }, [isRecording]);

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
            Click the microphone icon to start recording your voice, then click again when finished.
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
          
          {transcribedText && (
            <Text size="sm" mt="xs" style={{ fontStyle: 'italic' }}>
              Detected: {transcribedText}
            </Text>
          )}
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
