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
  Space
} from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { MessageList, Input, MessageBox } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
  };

  return (
    <>
      <Paper shadow="md" radius="md" p="md" withBorder style={{ height: '600px' }}>
        <Stack h="100%">
          <ScrollArea h="500px" viewportRef={viewport}>
            {messages.map((message, index) => (
              <Box
                key={index}
                mb="md"
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Group align="flex-start" gap="xs">
                  {message.role === 'assistant' && (
                    <Avatar 
                      size="md" 
                      radius="xl" 
                      src="/ai-avatar.png"  // Add your AI avatar image
                      alt="AI"
                    />
                  )}
                  <Paper
                    p="sm"
                    radius="lg"
                    style={{
                      maxWidth: '70%',
                      backgroundColor: message.role === 'user' ? '#228be6' : '#f1f3f5',
                    }}
                  >
                    <Text
                      size="sm"
                      style={{
                        color: message.role === 'user' ? 'white' : 'inherit',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {message.content}
                    </Text>
                  </Paper>
                  {message.role === 'user' && (
                    <Avatar 
                      size="md" 
                      radius="xl" 
                      src="/user-avatar.png"  // Add your user avatar image
                      alt="User"
                    />
                  )}
                </Group>
              </Box>
            ))}
          </ScrollArea>

          <form onSubmit={handleSubmit} style={{ marginTop: 'auto' }}>
            <Group gap="xs">
              <TextInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                style={{ flex: 1 }}
                radius="xl"
                size="md"
                rightSection={
                  <Button 
                    type="submit" 
                    radius="xl" 
                    size="xs"
                    variant="filled"
                    style={{ marginRight: 4 }}
                  >
                    <IconSend size={16} />
                  </Button>
                }
              />
            </Group>
          </form>
        </Stack>
      </Paper>

      <Space h="xl" />

      {/* React Chat Elements Demo */}
      <Paper shadow="md" radius="md" p="md" withBorder >
        <Stack h="100%">
            
          <MessageList
            className='message-list'
            lockable={true}
            toBottomHeight={'100%'}
            dataSource={messages.map((msg, index) => ({
              id: index,
              position: msg.role === 'user' ? 'right' : 'left',
              type: 'text',
              title: msg.role === 'user' ? 'You' : 'AI',
              text: msg.content,
              date: new Date(),
              focus: false,
              status: 'sent',
              notch: true,
              titleColor: msg.role === 'user' ? '#228be6' : '#666'
            }))}
            messageBoxStyles={{
              backgroundColor: '#f0f0f0',
              color: '#333333'
            }}
          />
          
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rightButtons={
              <Button onClick={handleSubmit}>
                <IconSend size={16} />
              </Button>
            }
          />
        </Stack>
        </Paper>
      <Space h="xl" />
      
    </>
  );
}