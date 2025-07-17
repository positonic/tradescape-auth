import { type NextPage } from "next";
import React from "react";
import { Container, Stack, Title, Text, Card } from "@mantine/core";

interface RoadmapItem {
  title: string;
  description: string;
  embed?: React.ReactNode;
}

interface RoadmapSection {
  title: string;
  items: RoadmapItem[];
}

const roadmapData: RoadmapSection[] = [
  {
    title: "🚀 Live Now",
    items: [
      {
        title: "Record voice with agent in a 'market scan' session",
        description:
          "Record your voice and scan a few markets",
          embed: (
            <div style={{ position: 'relative', paddingBottom: '62.43%', height: 0 }}>
              <iframe 
                src="https://www.loom.com/share/768dbd019de14abeb11fbcc044e1159c?sid=58e72991-0c85-4f3f-a1e5-bed240b8b9b7"
                frameBorder="0"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            </div>
          ),
      },
      {
        title: "Crypto analysis Video Transcription & Actionable Insights",
        description:
          "Provide a YouTube URL, transcribe its content, and take action on the transcription.",
          embed: (
            <div style={{ position: 'relative', paddingBottom: '62.43%', height: 0 }}>
              <iframe 
                src="https://www.loom.com/embed/e38cc17d51184d4880583ecaacdc9ea8?sid=50036dcf-4dfc-42d1-aecf-aa7b788689e6"
                frameBorder="0"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            </div>
          ),
      },
      {
        title: "Natural Language Task Management with LLM Agents",
        description:
          "Users can ask the AI to create tasks using natural language (e.g., 'Today I want to call my mum, go shopping, and rent a car'). Tasks are placed in relevant projects at the right time and place.",
        embed: (
          <div style={{ position: 'relative', paddingBottom: '62.43%', height: 0 }}>
            <iframe 
              src="https://www.loom.com/embed/cd1e3584aac1429fa448ef67723591f7?sid=90418359-b813-423f-8e84-7786bf59dd53"
              frameBorder="0"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        ),
      },
    ],
  },
  {
    title: "⚡ In Progress",
    items: [
      {
        title: "Conversational market scanning",
        description:
          "Scan markets with your co-pilot who saves the setups for you.",
      },
      
    ],
  },
  {
    title: "⏳ Coming Soon",
    items: [
      {
        title: "Journaling, Day Planning, Morning & Evening Routines",
        description:
          "AI-assisted daily planning and structured routines for better productivity.",
      },
      {
        title: "ELIZA Integration",
        description:
          "Currently working on deployment. Next steps include creating an ELIZA plugin for to-do and video functionality.",
      }
    ],
  }
];

const RoadmapPage: NextPage = () => {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="md" ta="center">
        🚀 Product Roadmap
      </Title>

      <Stack gap="xl">
        {roadmapData.map((section) => (
          <div key={section.title}>
            <Title order={2} mb="md">
              {section.title}
            </Title>
            
            <Stack gap="md">
              {section.items.map((item) => (
                <Card key={item.title} withBorder>
                  <Text size="lg" fw={500} mb="xs">
                    {item.title}
                  </Text>
                  <Text c="dimmed" mb={item.embed ? "md" : 0}>
                    {item.description}
                  </Text>
                  {item.embed}
                </Card>
              ))}
            </Stack>
          </div>
        ))}

        <div className="mt-12 text-center">
          <p className="text-lg">
            🚀 **Get Involved:** Join discussions on **[GitHub](https://github.com/positonic/ai-todo/discussions)** to help shape the
            roadmap and influence upcoming features.
          </p>
        </div>
      </Stack>
    </Container>
  );
};

export default RoadmapPage;
