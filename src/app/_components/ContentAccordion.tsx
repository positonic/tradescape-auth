'use client';

import { Accordion, Paper, Title, Text } from '@mantine/core';
import ReactMarkdown, { Components } from 'react-markdown';
import { type ReactNode } from 'react';

interface ContentAccordionProps {
  title: string;
  content: string;
  subtitle?: ReactNode;
  useMarkdown?: boolean;
}

interface MarkdownProps {
  children: ReactNode;
}

const YouTubeEmbed = ({ href, children }: { href: string; children: ReactNode }) => {
  try {
    const url = new URL(href);
    if (!url.hostname.includes('youtube.com')) {
      return <a href={href} className="text-blue-600 hover:underline">{children}</a>;
    }

    const videoId = url.searchParams.get('v');
    let start = url.searchParams.get('t') || '';
    if (start.endsWith('s')) {
      start = start.slice(0, -1);
    }
    const embedUrl = `https://www.youtube.com/embed/${videoId}${start ? `?start=${start}` : ''}`;

    return (
      <>
        <p className="font-medium mb-2">{children}:</p>
        <div className="aspect-video my-4">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </>
    );
  } catch (error) {
    return <a href={href} className="text-blue-600 hover:underline">{children}</a>;
  }
};

const markdownComponents: Partial<Components> = {
  h2: ({ children, ...props }) => (
    <Title order={2} mt="md" mb="xs" {...props}>
      {children}
    </Title>
  ),
  h3: ({ children, ...props }) => (
    <Title order={3} mt="md" mb="xs" {...props}>
      {children}
    </Title>
  ),
  h4: ({ children, ...props }) => (
    <Title order={4} mt="md" mb="xs" {...props}>
      {children}
    </Title>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-4 list-disc pl-6" {...props}>{children}</ul>
  ),
  li: ({ children, ...props }) => <li className="mb-2" {...props}>{children}</li>,
  p: ({ children, ...props }: React.HTMLProps<HTMLParagraphElement>) => (
    <Text size="sm" mb="md">
      {children}
    </Text>
  ),
  a: ({ href, children, ...props }) => {
    if (href?.includes('youtube.com/watch')) {
      return <YouTubeEmbed href={href}>{children}</YouTubeEmbed>;
    }
    return (
      <a href={href} className="text-blue-600 hover:underline" {...props}>
        {children}
      </a>
    );
  }
};

export function ContentAccordion({ 
  title, 
  content,
  subtitle,
  useMarkdown = true 
}: ContentAccordionProps) {
  return (
    <Accordion>
      <Accordion.Item value={title.toLowerCase()}>
        <Accordion.Control>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle}
        </Accordion.Control>
        <Accordion.Panel>
          <Paper shadow="sm" p="md" radius="md" withBorder>
            {useMarkdown ? (
              <ReactMarkdown components={markdownComponents}>
                {content}
              </ReactMarkdown>
            ) : (
              <div className="space-y-4">{content}</div>
            )}
          </Paper>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
} 