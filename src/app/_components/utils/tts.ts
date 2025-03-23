import { notifications } from '@mantine/notifications';

export async function speakText(text: string) {
  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    notifications.show({
      title: 'Configuration Error',
      message: 'ElevenLabs API key is not configured',
      color: 'red',
    });
    return;
  }

  // Validate API key format (should be 32 characters)
  if (apiKey.length < 32) {
    notifications.show({
      title: 'Configuration Error',
      message: 'Invalid ElevenLabs API key format',
      color: 'red',
    });
    return;
  }

  try {
    console.log('Using API key (first 4 chars):', apiKey.substring(0, 4));
    
    // Make a direct API call to ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(
        `ElevenLabs API error: ${response.status}${errorData?.error?.message ? ' - ' + errorData.error.message : ''}`
      );
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Create and play audio
    const audio = new Audio(audioUrl);
    
    // Clean up the blob URL after the audio finishes playing
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });

    // Handle any errors during playback
    audio.addEventListener('error', (e: Event) => {
      console.error('Audio playback error:', e);
      URL.revokeObjectURL(audioUrl);
      notifications.show({
        title: 'Error',
        message: 'Failed to play audio response',
        color: 'red',
      });
    });

    await audio.play();
  } catch (error) {
    console.error('Error playing audio:', error);
    notifications.show({
      title: 'Error',
      message: error instanceof Error ? error.message : String(error),
      color: 'red',
    });
  }
} 