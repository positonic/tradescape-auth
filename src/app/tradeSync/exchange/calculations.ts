export function minutesBetweenTimestamps(
  timestamp1: number,
  timestamp2: number,
): number {
  const diffInMilliseconds = Math.abs(timestamp1 - timestamp2);
  return diffInMilliseconds / 60000;
}

export function isVolumeDifferenceWithinThreshold(
  buyVolume: number,
  sellVolume: number,
  threshold: number,
): boolean {
  const volumePercent =
    (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) * 100;
  return volumePercent <= threshold;
}

export function positionSoldOut(
  buyVolume: number,
  sellVolume: number,
): boolean {
  return buyVolume - sellVolume === 0;
}
