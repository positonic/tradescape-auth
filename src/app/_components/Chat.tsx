'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from "~/trpc/react";
import { 
  Paper, 
  TextInput, 
  Button, 
  Stack, 
  ScrollArea, 
  Avatar, 
  Group, 
  Text,
  Box,
  ActionIcon
} from '@mantine/core';
import Link from 'next/link';
import { TradeSetups } from '~/app/_components/TradeSetups';
import { IconSend, IconMicrophone, IconMicrophoneOff, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { TextToSpeech } from '~/app/_components/TextToSpeech';
import { VoiceInput } from './VoiceInput';
import { speakText } from './utils/tts';

interface Message {
    type: 'system' | 'human' | 'ai' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
    tradeSetups?: MarketScanResult | null;
}

interface MarketScanResult {
  generalMarketContext: string;
  coins: Array<{
    coinSymbol: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    marketContext: string;
    tradeSetups: Array<{
      position: 'long' | 'short' | 'abstain';
      entryTriggers: string;
      entryPrice: string;
      timeframe: string;
      takeProfit: string;
      t1: string;
      t2: string;
      t3: string;
      stopLoss: string;
      stopLossPrice: number;
      invalidation: string;
      confidenceLevel: string;
      transcriptExcerpt: string;
    }>;
  }>;
}

interface CoinSetup {
  position: string;
  entryTriggers: string;
  entryPrice: string;
  timeframe: string;
  takeProfit: string;
  t1?: string;
  stopLoss: string;
  stopLossPrice?: number;
  invalidation: string;
  confidenceLevel: string;
  transcriptExcerpt: string;
}

interface CoinData {
  coinSymbol: string;
  sentiment: string;
  marketContext: string;
  tradeSetups: CoinSetup[];
}

interface ChatToolResult {
  toolName: string;
  result: string;
}

interface ChatResponse {
  validToolResults?: ChatToolResult[];
  response: string | Record<string, unknown>;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'system',
      content: `You are a personal assistant who helps manage tasks in our Task Management System. 
                You never give IDs to the user since those are just for you to keep track of. 
                When a user asks to create a task and you don't know the project to add it to for sure, clarify with the user.
                The current date is: ${new Date().toISOString().split('T')[0]}`
    },
    {
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. How can I help you manage your tasks today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const [selectedSetups, setSelectedSetups] = useState<number[]>([]);
  const [setups, setSetups] = useState<CoinData[]>([]);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const chat = api.tools.chat.useMutation({
    onSuccess: async (results) => {
      const marketScanResult = results.validToolResults?.find(
        (result): result is ChatToolResult => 
          result && 
          typeof result.toolName === 'string' && 
          result.toolName === 'market_scan' &&
          typeof result.result === 'string'
      );
      if (marketScanResult) {
        try {
          const tradeSetupsResult = JSON.parse(marketScanResult.result) as { coins: CoinData[] };
          const tradeSetups = tradeSetupsResult.coins?.map((coin: CoinData) => ({
            coinSymbol: coin.coinSymbol,
            sentiment: coin.sentiment,
            marketContext: coin.marketContext,
            tradeSetups: coin.tradeSetups
          }));
          setSetups(tradeSetups ?? []);
        } catch (e) {
          console.error('Failed to parse trade setups:', e);
        }
      }
    }
  });
  //const transcribeAudio = api.tools.transcribe.useMutation();
  const transcribeAudio = api.tools.transcribeFox.useMutation(); 
  const getPairBySymbol = api.setups.getPairBySymbol.useMutation();
  const saveSetups = api.setups.create.useMutation({
    onSuccess: () => {
      setSelectedSetups([]);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // const startRecording = async () => {
  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  //     const mediaRecorder = new MediaRecorder(stream);
  //     mediaRecorderRef.current = mediaRecorder;
  //     chunksRef.current = [];

  //     mediaRecorder.ondataavailable = (e) => {
  //       if (e.data.size > 0) {
  //         chunksRef.current.push(e.data);
  //       }
  //     };

  //     mediaRecorder.onstop = async () => {
  //       const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
  //       stream.getTracks().forEach(track => track.stop());
        
  //       try {
  //         // Convert blob to base64
  //         const reader = new FileReader();
  //         reader.readAsDataURL(audioBlob);
  //         reader.onloadend = async () => {
  //           const base64Audio = typeof reader.result === 'string' 
  //             ? reader.result.split(',')[1]
  //             : '';
  //           if (base64Audio) {
  //             const result = await transcribeAudio.mutateAsync({ audio: base64Audio });
  //             if (result.text) {
  //               setInput(result.text);
  //             }
  //           }
  //         };
  //       } catch (error) {
  //         console.error('Transcription error:', error);
  //       }
  //     };

  //     mediaRecorder.start();
  //     setIsRecording(true);
  //   } catch (err) {
  //     console.error('Error accessing microphone:', err);
  //     alert('Could not access microphone. Please check your permissions.');
  //   }
  // };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop the media recorder
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;

      // Stop all tracks in the stream
      if (chunksRef.current) {
        chunksRef.current = [];
      }

      setIsRecording(false);
    }
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (chunksRef.current) {
        chunksRef.current = [];
      }
    };
  }, []);

  

  const handleVoiceInput = async (base64Audio: string) => {
    setIsProcessingVoice(true);
    try {
      const result = await transcribeAudio.mutateAsync({ audio: base64Audio });
      if (result.text) {
        setInput(result.text);
        // Submit the transcribed text directly without event
        void submitMessage(result.text);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Error',
        message: 'Failed to process voice input. Please try again.',
        color: 'red'
      });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const submitMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = { type: 'human', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAiThinking(true);

    try {
      const response = await chat.mutateAsync({
        message: message,
        history: messages
      }) as ChatResponse;

      const marketScanResult = response.validToolResults?.find(
        (result): result is ChatToolResult => 
          typeof result.toolName === 'string' && 
          result.toolName === 'market_scan'
      );

      let tradeSetups: MarketScanResult | null = null;
      let agentResponse = "";
      if (marketScanResult) {
        try {
          tradeSetups = JSON.parse(marketScanResult.result) as MarketScanResult;
          agentResponse = `Created ${tradeSetups?.coins?.length ?? 0} trade setups`;
        } catch (e) {
          console.error('Failed to parse trade setups:', e);
        }
      } else {
        agentResponse = typeof response.response === 'string' 
          ? response.response 
          : JSON.stringify(response.response);
      }

      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: agentResponse,
        tradeSetups: tradeSetups
      }]);

      if (audioEnabled) {
        await speakText(agentResponse);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'Sorry, I encountered an error processing your request.' 
      }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage(input);
  };

  const renderMessageContent = (content: string) => {
    // Regular expression to match YouTube video IDs in square brackets
    const videoPattern = /\[Video ([a-zA-Z0-9_-]+)\]/g;
    
    // Split the content into parts and replace video references with links
    const parts = content.split(videoPattern);
    
    if (parts.length === 1) {
      return content; // No video IDs found, return original content
    }

    return parts.map((part, index) => {
      // Every odd index in parts array will be a video ID
      if (index % 2 === 1) {
        return (
          <a 
            key={index} 
            href={`/video/${part}`}
            style={{ 
              color: 'inherit', 
              textDecoration: 'underline' 
            }}
          >
            {`Video ${part}`}
          </a>
        );
      }
      return part;
    });
  };

  const handleSaveSetups = () => {
    if (!selectedSetups.length) return;

    const extractNumber = (str: string): number | null => {
      const regex = /\d+/;
      const result = regex.exec(str);
      return result ? parseFloat(result[0]) : null;
    };

    Promise.all(
      setups.flatMap((coin) =>
        coin.tradeSetups.map(async (setup: CoinSetup, setupIndex: number) => {
          if (selectedSetups.includes(setupIndex)) {
            try {
              // Get the pair ID for this coin
              const pair = await getPairBySymbol.mutateAsync({ 
                symbol: coin.coinSymbol 
              });

              if (!pair) {
                throw new Error(`No pair found for ${coin.coinSymbol}`);
              }

              return {
                content: setup.transcriptExcerpt ?? `${setup.position} setup for ${coin.coinSymbol}`,
                entryPrice: extractNumber(setup.entryPrice),
                takeProfitPrice: setup.t1 ? parseFloat(setup.t1) : extractNumber(setup.takeProfit),
                stopPrice: setup.stopLossPrice ?? extractNumber(setup.stopLoss),
                timeframe: setup.timeframe ?? "Not specified",
                direction: setup.position,
                pairId: pair.id,
              };
            } catch (error) {
              console.error(`Failed to get pair for ${coin.coinSymbol}:`, error);
              notifications.show({
                title: 'Error',
                message: `Failed to get trading pair for ${coin.coinSymbol}`,
                color: 'red',
              });
              return null;
            }
          }
          return null;
        })
      )
    )
      .then((setupPromises) => {
        return Promise.all(
          setupPromises
            .filter((setup): setup is NonNullable<typeof setup> => setup !== null)
            .map(setup => saveSetups.mutateAsync(setup))
        );
      })
      .then(() => {
        notifications.show({
          title: 'Success',
          message: `Successfully saved ${selectedSetups.length} trade setup${selectedSetups.length > 1 ? 's' : ''}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      })
      .catch((error: Error) => {
        notifications.show({
          title: 'Error',
          message: error.message ?? 'Failed to save trade setups',
          color: 'red',
        });
      });
  };

  return (
      <Paper 
        shadow="md" 
        radius="sm"
        p="md" 
        w="100%"
        style={{ 
          height: '600px',
          backgroundColor: '#ffffff'
        }}
      >
        <Stack h="100%">
          <ScrollArea h="500px" viewportRef={viewport}>
            {messages.filter(message => message.type !== 'system').map((message, index) => (
              <Box
                key={index}
                mb="md"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.type === 'human' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <Group 
                  align="flex-start" 
                  gap="xs"
                  style={{
                    maxWidth: '80%',
                    flexDirection: message.type === 'human' ? 'row-reverse' : 'row',
                    width: 'auto'
                  }}
                >
                  {message.type === 'ai' && (
                    <Avatar 
                      size="md" 
                      radius="xl" 
                      src={null}
                      alt="AI"
                    />
                  )}
                  <Paper
                    p="sm"
                    radius="lg"
                    style={{
                      maxWidth: '100%',
                      backgroundColor: message.type === 'human' ? '#228be6' : '#f1f3f5',
                    }}
                  >
                    <Text
                      size="sm"
                      style={{
                        color: message.type === 'human' ? 'white' : '#1A1B1E',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {renderMessageContent(message.content)}
                    </Text>
                    {message.type === 'ai' && (
                      <Group justify="flex-end" mt="xs">
                        {audioEnabled && (
                          <TextToSpeech text={message.content} />
                        )}
                      </Group>
                    )}
                  </Paper>
                  {message.type === 'human' && (
                    <Avatar 
                      size="md" 
                      radius="xl" 
                      src={null}
                      alt="User"
                    />
                  )}
                </Group>
                {message.tradeSetups && (
                  <Box mt="sm" style={{ width: '100%' }}>
                    <TradeSetups 
                      setups={message.tradeSetups}
                      selectedSetups={selectedSetups}
                      onSetupSelectionChange={setSelectedSetups}
                    />
                    <br/>
                    Select any setups you would like to save using the checkboxes above.<br/><br/>
                    <Link href="/setups" className="text-blue-500 hover:text-blue-700 underline">View all setups here</Link>
                  </Box>
                )}
              </Box>
            ))}
            
            {isAiThinking && (
              <Box mb="md" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Group align="flex-start" gap="xs">
                  <Avatar size="md" radius="xl" src={null} alt="AI" />
                  <Paper
                    p="sm"
                    radius="lg"
                    style={{
                      backgroundColor: '#f1f3f5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Text size="sm" style={{ color: '#1A1B1E' }}>
                      AI is thinking
                    </Text>
                    <Box
                      component="span"
                      style={{
                        display: 'inline-flex',
                        gap: '4px',
                        marginLeft: '4px'
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          component="span"
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: '#1A1B1E',
                            animation: 'typing 1s infinite',
                            animationDelay: `${i * 0.3}s`
                          }}
                        />
                      ))}
                    </Box>
                  </Paper>
                </Group>
              </Box>
            )}
          </ScrollArea>

          {selectedSetups.length > 0 && (
            <Button
              onClick={handleSaveSetups}
              loading={saveSetups.isPending}
              mb="md"
              variant="filled"
              color="blue"
            >
              Save {selectedSetups.length} Selected Setup{selectedSetups.length > 1 ? 's' : ''}
            </Button>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: 'auto' }}>
            <Stack gap="md">
              <VoiceInput 
                onTranscriptionComplete={handleVoiceInput}
                isProcessing={isProcessingVoice}
                onAudioEnabled={setAudioEnabled}
              />
              <Group align="flex-end">
                <TextInput
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  style={{ flex: 1 }}
                  radius="sm"
                  size="lg"
                  styles={{
                    input: {
                      backgroundColor: '#ffffff',
                      color: '#1A1B1E',
                      '&::placeholder': {
                        color: '#868e96'
                      }
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  radius="sm"
                  size="lg"
                  variant="filled"
                  loading={isAiThinking}
                >
                  <IconSend size={16} />
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>

  );
}