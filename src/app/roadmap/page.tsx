"use client";

import { Container, Title, Timeline, Text, Card, ThemeIcon, Badge, Stack } from "@mantine/core";
import {
  IconCheck,
  IconMicrophone,
  IconChartLine,
  IconChartBar,
} from "@tabler/icons-react";
import { motion } from "framer-motion";

interface RoadmapItem {
  title: string;
  description: string;
  status: "completed" | "inProgress" | "upcoming";
  features: string[];
  icon: React.ElementType;
  video?: string;
}

const roadmapData: RoadmapItem[] = [
  {
    title: "Voice-Enabled Trade Analysis",
    description: "Record and analyze trading setups using voice commands.",
    status: "completed",
    icon: IconMicrophone,
    features: [
      "Voice recording for trade analysis",
      "Automatic setup detection",
      "Real-time audio visualization",
      "Direct storage to user account"
    ],
    video: ""
  },
  {
    title: "Core Trading Features",
    description: "Essential trading setup management and analysis.",
    status: "completed",
    icon: IconChartLine,
    features: [
      "Setup creation and tracking",
      "Price level management",
      "Trade status monitoring",
      "Basic analytics"
    ]
  },
  {
    title: "Shared Setups",
    description: "Essential trading setup management and analysis.",
    status: "inProgress",
    icon: IconChartLine,
    features: [
      "Share your setups with other users",
      "Role-based access",
    ]
  },
  {
    title: "Setup alerts",
    description: "Create alerts to activate / invalidate setups",
    status: "upcoming",
    icon: IconChartBar,
    features: [
      "Context within which to activate / invalidate setups",
      "Price and moving average alerts",
      "Candle close alerts"
    ]
  },
  {
    title: "Advanced Analytics",
    description: "Comprehensive trading performance analysis.",
    status: "upcoming",
    icon: IconChartBar,
    features: [
      "Performance metrics",
      "Win rate analysis",
      "Risk management tools",
      "Pattern recognition"
    ]
  },
  // {
  //   title: "Team Trading",
  //   description: "Collaborative trading features for teams.",
  //   status: "upcoming",
  //   icon: IconUsers,
  //   features: [
  //     "Shared setups",
  //     "Team performance tracking",
  //     "Role-based access",
  //     "Communication tools"
  //   ]
  // }
];

const getStatusColor = (status: RoadmapItem["status"]) => {
  switch (status) {
    case "completed":
      return "green";
    case "inProgress":
      return "violet";
    case "upcoming":
      return "gray";
  }
};

const getStatusBadge = (status: RoadmapItem["status"]) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "inProgress":
      return "In Progress";
    case "upcoming":
      return "Coming Soon";
  }
};

export default function RoadmapPage() {
  return (
    <Container size="lg" py="xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <Title
          className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-4"
        >
          Product Roadmap
        </Title>
        <Text c="dimmed" size="xl" className="max-w-3xl mx-auto">
          Track our journey from idea to reality. See what we&apos;ve built and what&apos;s coming next.
        </Text>
      </motion.div>

      <Timeline active={3} bulletSize={32} lineWidth={2} color="violet">
        {roadmapData.map((item, index) => (
          <Timeline.Item
            key={item.title}
            bullet={
              <ThemeIcon
                size={32}
                radius="xl"
                color={getStatusColor(item.status)}
                variant={item.status === "upcoming" ? "light" : "filled"}
              >
                <item.icon size={18} />
              </ThemeIcon>
            }
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card withBorder className="mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Text size="lg" fw={500} className="mb-1">
                      {item.title}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {item.description}
                    </Text>
                  </div>
                  <Badge
                    color={getStatusColor(item.status)}
                    variant={item.status === "upcoming" ? "light" : "filled"}
                    size="lg"
                  >
                    {getStatusBadge(item.status)}
                  </Badge>
                </div>

                <Stack gap="xs">
                  {item.features.map((feature, fIndex) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: (index * 0.1) + (fIndex * 0.05) }}
                    >
                      <Text size="sm" className="flex items-start gap-2">
                        <IconCheck 
                          size={16} 
                          className={item.status === "upcoming" ? "text-gray-500" : "text-violet-400"} 
                        />
                        {feature}
                      </Text>
                    </motion.div>
                  ))}
                </Stack>

                {item.video && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: (index * 0.1) + 0.3 }}
                    className="mt-4"
                  >
                    <div className="relative pt-[62.5%]">
                      <iframe
                        src={item.video}
                        className="absolute inset-0 w-full h-full rounded-md"
                        frameBorder="0"
                        allowFullScreen
                      />
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          </Timeline.Item>
        ))}
      </Timeline>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="mt-12 text-center"
      >
        <Text c="dimmed">
          🚀 Want to influence our roadmap? Join the discussion on{" "}
          <Text
            component="a"
            href="https://github.com/positonic/ai-todo/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            GitHub
          </Text>
        </Text>
      </motion.div>
    </Container>
  );
}
