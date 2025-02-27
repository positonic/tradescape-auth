'use client';

import { Badge } from '@mantine/core';
import { api } from "~/trpc/react";

export default function HavenMemberBadge() {
  const { data, isLoading, error } = api.discord.checkHavenMembership.useQuery(undefined, {
    retry: false
  });

  if (error) {
    console.error('Error checking Haven membership:', error);
    return null;
  }

  if (isLoading) return null;
  
  return data?.isHavenMember ? (
    <Badge color="blue" variant="light" className="mb-2">
      Haven Member
    </Badge>
  ) : null;
} 