import { api } from "~/trpc/react";
import { notifications } from '@mantine/notifications';

export const useSyncTrades = () => {
  const utils = api.useUtils();

  return api.pairs.syncTrades.useMutation({
    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: `${data.message} (${data.tradesFound} trades, ${data.pairsFound} pairs)`,
        color: 'green',
      });
      
      // Invalidate trades and orders queries to refetch fresh data
      void utils.trades.getTrades.invalidate();
      void utils.trades.getOrders.invalidate();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });
};