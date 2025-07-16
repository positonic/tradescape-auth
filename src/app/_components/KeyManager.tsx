'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Button,
  Group,
  Text,
  Stack,
  TextInput,
  Select,
  Checkbox,
  Alert,
  ActionIcon,
  Divider,
} from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { 
  type DecryptedKeys, 
  KeyStorage, 
  validateKeys, 
  encryptForTransmission,
  EXCHANGE_CONFIGS
} from '~/lib/keyEncryption';

interface KeyManagerProps {
  onKeysReady: (encryptedKeys: string) => void;
  isLoading?: boolean;
}

const SUPPORTED_EXCHANGES = EXCHANGE_CONFIGS.map(config => ({
  value: config.id,
  label: config.name
}));

export default function KeyManager({ onKeysReady, isLoading }: KeyManagerProps) {
  const [keys, setKeys] = useState<DecryptedKeys[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [hasStoredKeys, setHasStoredKeys] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // Load saved keys on mount
    const savedKeys = KeyStorage.load();
    if (savedKeys) {
      setKeys(savedKeys);
      setHasStoredKeys(true);
      setShowForm(false);
    } else {
      // Start with one empty key if no saved keys
      setKeys([{
        exchange: '',
        apiKey: '',
        apiSecret: '',
        passphrase: '',
        walletAddress: '',
        sandbox: false,
      }]);
      setShowForm(true);
    }
  }, []);

  const addNewExchange = () => {
    setShowForm(true);
    setKeys([{
      exchange: '',
      apiKey: '',
      apiSecret: '',
      passphrase: '',
      walletAddress: '',
      sandbox: false,
    }]);
  };

  const updateKey = (index: number, field: keyof DecryptedKeys, value: string | boolean) => {
    setKeys(prev => prev.map((key, i) => 
      i === index ? { ...key, [field]: value } : key
    ));
  };

  const toggleSecretVisibility = (index: number) => {
    setShowSecrets(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSyncTrades = () => {
    // Validate keys
    const errors = validateKeys(keys);
    if (errors.length > 0) {
      notifications.show({
        title: 'Validation Error',
        message: errors.join(', '),
        color: 'red',
      });
      return;
    }

    // Always save to storage (encrypted)
    KeyStorage.save(keys, true);
    setHasStoredKeys(true);
    setShowForm(false);

    // Encrypt for transmission
    const encrypted = encryptForTransmission(keys);
    onKeysReady(encrypted);
  };

  const clearStoredKeys = () => {
    KeyStorage.clear();
    setHasStoredKeys(false);
    setShowForm(false);
    notifications.show({
      title: 'Keys Cleared',
      message: 'Stored keys have been cleared from local storage',
      color: 'blue',
    });
  };

  const isValidKey = (key: DecryptedKeys) => {
    if (!key.exchange) return false;
    
    const config = EXCHANGE_CONFIGS.find(c => c.id === key.exchange);
    if (!config) return false;
    
    // Check all required credentials
    if (config.requiredCredentials.apiKey && !key.apiKey) return false;
    if (config.requiredCredentials.apiSecret && !key.apiSecret) return false;
    if (config.requiredCredentials.passphrase && !key.passphrase) return false;
    if (config.requiredCredentials.walletAddress && !key.walletAddress) return false;
    
    return true;
  };

  const allKeysValid = keys.length > 0 && keys.every(isValidKey);

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>Exchange API Keys</Title>
        {hasStoredKeys && (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            onClick={clearStoredKeys}
          >
            Clear Stored Keys
          </Button>
        )}
      </Group>

      <Alert color="yellow" mb="md">
        <Text size="sm">
          <strong>Security Notice:</strong> Your API keys are encrypted before transmission and storage. 
          Never share your API keys with anyone. Recommend using read-only keys when possible.
        </Text>
      </Alert>

      {hasStoredKeys && !showForm ? (
        <Stack gap="md">
          <Alert color="green">
            <Text size="sm">
              ✅ Exchange API keys are saved and encrypted in your browser.
            </Text>
          </Alert>
          <Group justify="space-between">
            <Button
              variant="outline"
              onClick={addNewExchange}
            >
              Add New Exchange
            </Button>
            <Button
              onClick={() => {
                // Use existing saved keys
                const encrypted = encryptForTransmission(keys);
                onKeysReady(encrypted);
              }}
              loading={isLoading}
            >
              Sync Trades
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="lg">
          {keys.map((key, index) => (
            <Paper key={index} p="sm" withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={500}>Exchange Configuration</Text>
              </Group>

              <Stack gap="sm">
                <Select
                  label="Exchange"
                  placeholder="Select exchange"
                  data={SUPPORTED_EXCHANGES}
                  value={key.exchange}
                  onChange={(value) => updateKey(index, 'exchange', value ?? '')}
                  required
                />

                {(() => {
                  const config = EXCHANGE_CONFIGS.find(c => c.id === key.exchange);
                  if (!config) return null;

                  return (
                    <>
                      {config.requiredCredentials.apiKey && (
                        <TextInput
                          label="API Key"
                          placeholder="Enter your API key"
                          value={key.apiKey}
                          onChange={(e) => updateKey(index, 'apiKey', e.currentTarget.value)}
                          required
                        />
                      )}

                      {config.requiredCredentials.apiSecret && (
                        <Group align="end">
                          <TextInput
                            label="API Secret"
                            placeholder="Enter your API secret"
                            type={showSecrets[index] ? 'text' : 'password'}
                            value={key.apiSecret}
                            onChange={(e) => updateKey(index, 'apiSecret', e.currentTarget.value)}
                            style={{ flex: 1 }}
                            required
                          />
                          <ActionIcon
                            variant="subtle"
                            onClick={() => toggleSecretVisibility(index)}
                            title={showSecrets[index] ? 'Hide secret' : 'Show secret'}
                          >
                            {showSecrets[index] ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </ActionIcon>
                        </Group>
                      )}

                      {config.requiredCredentials.passphrase && (
                        <TextInput
                          label="Passphrase"
                          placeholder="Enter passphrase (required for this exchange)"
                          type={showSecrets[index] ? 'text' : 'password'}
                          value={key.passphrase}
                          onChange={(e) => updateKey(index, 'passphrase', e.currentTarget.value)}
                          required
                        />
                      )}

                      {config.requiredCredentials.walletAddress && (
                        <TextInput
                          label="Wallet Address"
                          placeholder="Enter your wallet address"
                          value={key.walletAddress}
                          onChange={(e) => updateKey(index, 'walletAddress', e.currentTarget.value)}
                          required
                        />
                      )}

                      <Checkbox
                        label="Sandbox/Testnet"
                        checked={key.sandbox}
                        onChange={(e) => updateKey(index, 'sandbox', e.currentTarget.checked)}
                      />
                    </>
                  );
                })()}
              </Stack>
            </Paper>
          ))}

          <Divider />

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Keys will be encrypted and saved automatically
            </Text>
            <Button
              onClick={handleSyncTrades}
              loading={isLoading}
              disabled={!allKeysValid}
            >
              Save & Sync Trades
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}