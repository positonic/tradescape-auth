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
  ActionIcon,
  Notification
} from '@mantine/core';
import { TradeSetups } from '~/app/_components/TradeSetups';
import { IconSend, IconMicrophone, IconMicrophoneOff, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

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
    sentiment: string;
    marketContext: string;
    tradeSetups: Array<{
      position: string;
      entryTriggers: string;
      entryPrice: string;
      timeframe: string;
      takeProfit: string;
      stopLoss: string;
      invalidation: string;
      confidenceLevel: string;
      transcriptExcerpt: string;
    }>;
  }>;
}

interface TradeSetup {
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
  const [setups, setSetups] = useState<any[]>([]);
  
  const utils = api.useUtils();
  const chat = api.tools.chat.useMutation({
    onSuccess: async (results) => {
      console.log('chat.onSuccess', results);
      const marketScanResult = results.validToolResults?.find(result => result.toolName === 'market_scan');
      if (marketScanResult) {
        const tradeSetupsResult = JSON.parse(marketScanResult.result);
        const tradeSetups = tradeSetupsResult?.coins?.map((coin: any) => ({
          coinSymbol: coin.coinSymbol,
          sentiment: coin.sentiment,
          marketContext: coin.marketContext,
          tradeSetups: coin.tradeSetups
        }));
        console.log("setup coins is ", tradeSetups);
        setSetups(tradeSetups);
        // setMessages(prev => [...prev, {
        //   type: 'ai',
        //   content: `Created ${tradeSetups?.coins?.length} trade setups`,
        //   tradeSetups: tradeSetups
        // }]);
      }
      // Invalidate all action-related queries to refresh counts
      await Promise.all([
        utils.action.getAll.invalidate(),
        utils.action.getToday.invalidate()
      ]);
    }
  });
  const transcribeAudio = api.tools.transcribe.useMutation();
//const transcribeAudio = api.tools.transcribeFox.useMutation(); 
  const saveSetups = api.setups.create.useMutation({
    onSuccess: () => {
      // Clear selected setups after saving
      setSelectedSetups([]);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = typeof reader.result === 'string' 
              ? reader.result.split(',')[1]
              : '';
            if (base64Audio) {
              const result = await transcribeAudio.mutateAsync({ audio: base64Audio });
              if (result.text) {
                setInput(result.text);
              }
            }
          };
        } catch (error) {
          console.error('Transcription error:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { type: 'human', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAiThinking(true);

    try {
      const response = await chat.mutateAsync({
        message: input,
        history: messages
      });

      // Find market scan result if it exists
      const marketScanResult = response.validToolResults?.find(
        result => result.toolName === 'market_scan'
      );

      let tradeSetups: MarketScanResult | null = null;
      let agentResponse = "";
      if (marketScanResult) {
        try {
          tradeSetups = JSON.parse(marketScanResult.result);
          agentResponse = `Created ${tradeSetups?.coins?.length} trade setups`;
          console.log('x: tradeSetups', tradeSetups);
          console.log('x: agentResponse', agentResponse);
        } catch (e) {
          console.error('Failed to parse trade setups:', e);
        }
      } else {
        agentResponse = typeof response.response === 'string' 
        ? response.response 
        : JSON.stringify(response.response)
      }

      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: agentResponse,
        tradeSetups: tradeSetups
      }]);
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
    console.log("x: selectedSetups", selectedSetups);
    console.log("x: setups", setups);

    // Helper function to extract first number from string
    const extractNumber = (str: string): number | null => {
      const match = str.match(/\d+/);
      return match ? parseFloat(match[0]) : null;
    };

    // Flatten and transform setups
    const setupsToSave = setups.flatMap((coin, coinIndex) => 
      coin.tradeSetups.map((setup: TradeSetup, setupIndex: number) => {
        const globalIndex = setupIndex; // You might need to adjust this based on your indexing logic
        
        if (selectedSetups.includes(globalIndex)) {
          return {
            content: setup.transcriptExcerpt || `${setup.position} setup for ${coin.coinSymbol}`,
            entryPrice: extractNumber(setup.entryPrice),
            takeProfitPrice: setup.t1 ? parseFloat(setup.t1) : extractNumber(setup.takeProfit),
            stopPrice: setup.stopLossPrice || extractNumber(setup.stopLoss),
            timeframe: setup.timeframe || "Not specified",
            //videoId: "temp-video-id", // TODO: Get from context
            pairId: 1, // TODO: Get or create pair ID based on coin.coinSymbol
          };
        }
        return null;
      })
    ).filter((setup): setup is NonNullable<typeof setup> => setup !== null);

    console.log("setupsToSave is ", setupsToSave);
    // Save each setup
    Promise.all(setupsToSave.map(setup => saveSetups.mutateAsync(setup)))
      .then(() => {
        notifications.show({
          title: 'Success',
          message: `Successfully saved ${setupsToSave.length} trade setup${setupsToSave.length > 1 ? 's' : ''}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      })
      .catch((error) => {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to save trade setups',
          color: 'red',
        });
        console.error('Error saving setups:', error);
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
              loading={saveSetups.isLoading}
              mb="md"
              variant="filled"
              color="blue"
            >
              Save {selectedSetups.length} Selected Setup{selectedSetups.length > 1 ? 's' : ''}
            </Button>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: 'auto' }}>
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
                rightSectionWidth={100}
                rightSection={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ActionIcon
                      onClick={handleMicClick}
                      variant="subtle"
                      color={isRecording ? "red" : "gray"}
                      className={isRecording ? "animate-pulse" : ""}
                      size="sm"
                    >
                      {isRecording ? (
                        <IconMicrophoneOff size={16} />
                      ) : (
                        <IconMicrophone size={16} />
                      )}
                    </ActionIcon>
                    <Button 
                      type="submit" 
                      radius="sm"
                      size="sm"
                      variant="filled"
                    >
                      <IconSend size={16} />
                    </Button>
                  </div>
                }
              />
            </Group>
          </form>
        </Stack>
      </Paper>

  );
}