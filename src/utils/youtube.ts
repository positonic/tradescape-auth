export function extractYoutubeSlugFromUrl(url: string): string {
  // Regular expressions for different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /^[a-zA-Z0-9_-]{11}$/
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match?.[1]) {
      return match[1];
    }
  }

  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');
    if (videoId) {
      return videoId;
    }
  } catch {
    // Invalid URL, continue to throw error
  }

  throw new Error('Could not extract YouTube video ID from URL');
} 