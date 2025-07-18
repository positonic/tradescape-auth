"use client";

import { Accordion, Paper, Title, Text } from "@mantine/core";
import ReactMarkdown, { type Components } from "react-markdown";
import { type ReactNode } from "react";

interface ContentAccordionProps {
  title: string;
  content: string;
  subtitle?: ReactNode;
  useMarkdown?: boolean;
}

interface MarkdownProps {
  children: ReactNode;
}

const YouTubePlayer = ({
  videoId,
  startTime,
}: {
  videoId: string;
  startTime?: string;
}) => {
  const embedUrl = `https://www.youtube.com/embed/${videoId}${startTime ? `?start=${startTime}` : ""}`;

  return (
    <div className="sticky top-4 aspect-video">
      <iframe
        className="h-full w-full"
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

const TimeStampLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => {
  try {
    const url = new URL(href);
    if (!url.hostname.includes("youtube.com")) {
      return (
        <a href={href} className="text-blue-600 hover:underline">
          {children}
        </a>
      );
    }

    const videoId = url.searchParams.get("v");
    let start = url.searchParams.get("t") ?? "";
    console.log("TimeStampLink: url", url);
    console.log("TimeStampLink: start", start);
    if (start.endsWith("s")) {
      start = start.slice(0, -1);
    }

    return (
      <button
        onClick={() => {
          const player = document.querySelector("iframe")!;
          if (player) {
            player.src = `https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1`;
          }
        }}
        className="text-left text-blue-600 hover:underline"
      >
        {children}
      </button>
    );
  } catch (error) {
    console.error("TimeStampLink: error", error);
    return (
      <a href={href} className="text-blue-600 hover:underline">
        {children}
      </a>
    );
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
    <ul className="mb-4 list-disc pl-6" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="mb-2" {...props}>
      {children}
    </li>
  ),
  p: ({ children }: React.HTMLProps<HTMLParagraphElement>) => (
    <Text size="sm" mb="md">
      {children}
    </Text>
  ),
  a: ({ href, children, ...props }) => {
    if (href?.includes("youtube.com/watch")) {
      return <TimeStampLink href={href}>{children}</TimeStampLink>;
    }
    return (
      <a href={href} className="text-blue-600 hover:underline" {...props}>
        {children}
      </a>
    );
  },
};

export function ContentAccordion({
  title,
  content,
  subtitle,
  useMarkdown = true,
}: ContentAccordionProps) {
  // Extract first video ID from content
  const regex = /youtube\.com\/watch\?v=([^&\s]+)/;
const firstVideoMatch = regex.exec(content);


  return (
    <Accordion>
      <Accordion.Item value={title.toLowerCase()}>
        <Accordion.Control>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle}
        </Accordion.Control>
        <Accordion.Panel>
          <Paper shadow="sm" p="md" radius="md" withBorder className="w-full">
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
