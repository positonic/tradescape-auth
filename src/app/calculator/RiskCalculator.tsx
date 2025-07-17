'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Title, 
  Stack, 
  NumberInput, 
  Paper, 
  Group, 
  Text, 
  Badge,
  Switch,
  Grid,
  Divider,
  Card,
  Alert
} from '@mantine/core';

// --- Configuration for localStorage ---
const ACCOUNT_SIZE_KEY = 'riskCalculator_accountSize_v1';
const RISK_PERCENTAGE_KEY = 'riskCalculator_riskPercentage_v1';
const SL_PERCENTAGE_KEY = 'riskCalculator_slPercentage_v1';
const FEES_PERCENTAGE_KEY = 'riskCalculator_feesPercentage_v1';
const RR_RATIO_KEY = 'riskCalculator_rrRatio_v1';

interface RiskCalculations {
  riskInDollars: number;
  positionSize: number;
  profitIfTPHit: number;
  positionSizeWithFees?: number;
  profitIfTPHitWithFees?: number;
}

const RiskCalculator: React.FC = () => {
  // --- Persistent Settings ---
  const [accountSize, setAccountSize] = useState<number | ''>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(ACCOUNT_SIZE_KEY) : null;
    return saved ? parseFloat(saved) : 100000;
  });

  const [riskPercentage, setRiskPercentage] = useState<number | ''>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(RISK_PERCENTAGE_KEY) : null;
    return saved ? parseFloat(saved) : 2.0;
  });

  const [slPercentage, setSlPercentage] = useState<number | ''>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(SL_PERCENTAGE_KEY) : null;
    return saved ? parseFloat(saved) : 3.0;
  });

  const [feesPercentage, setFeesPercentage] = useState<number | ''>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(FEES_PERCENTAGE_KEY) : null;
    return saved ? parseFloat(saved) : 0.1;
  });

  const [rrRatio, setRrRatio] = useState<number | ''>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(RR_RATIO_KEY) : null;
    return saved ? parseFloat(saved) : 3.0;
  });

  // --- UI State ---
  const [includeFees, setIncludeFees] = useState(false);
  const [calculations, setCalculations] = useState<RiskCalculations | null>(null);

  // --- Effects for localStorage ---
  useEffect(() => {
    if (typeof window !== 'undefined' && accountSize !== '') {
      localStorage.setItem(ACCOUNT_SIZE_KEY, accountSize.toString());
    }
  }, [accountSize]);

  useEffect(() => {
    if (typeof window !== 'undefined' && riskPercentage !== '') {
      localStorage.setItem(RISK_PERCENTAGE_KEY, riskPercentage.toString());
    }
  }, [riskPercentage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && slPercentage !== '') {
      localStorage.setItem(SL_PERCENTAGE_KEY, slPercentage.toString());
    }
  }, [slPercentage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && feesPercentage !== '') {
      localStorage.setItem(FEES_PERCENTAGE_KEY, feesPercentage.toString());
    }
  }, [feesPercentage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && rrRatio !== '') {
      localStorage.setItem(RR_RATIO_KEY, rrRatio.toString());
    }
  }, [rrRatio]);

  // --- Calculation Logic ---
  const calculateRisk = useCallback(() => {
    if (
      accountSize === '' || 
      riskPercentage === '' || 
      slPercentage === '' || 
      rrRatio === '' ||
      Number(accountSize) <= 0 ||
      Number(riskPercentage) <= 0 ||
      Number(slPercentage) <= 0 ||
      Number(rrRatio) <= 0
    ) {
      setCalculations(null);
      return;
    }

    const account = Number(accountSize);
    const riskPct = Number(riskPercentage);
    const slPct = Number(slPercentage);
    const rr = Number(rrRatio);

    // Basic calculations (without fees)
    const riskInDollars = account * (riskPct / 100);
    const positionSize = riskInDollars / (slPct / 100);
    const profitIfTPHit = riskInDollars * rr;

    const calcs: RiskCalculations = {
      riskInDollars,
      positionSize,
      profitIfTPHit
    };

    // Fee calculations if enabled
    if (includeFees && feesPercentage !== '' && Number(feesPercentage) > 0) {
      const feesPct = Number(feesPercentage);
      const totalSlPct = slPct + (2 * feesPct); // 2x fees for in/out
      const positionSizeWithFees = riskInDollars / (totalSlPct / 100);
      const profitIfTPHitWithFees = riskInDollars * rr;

      calcs.positionSizeWithFees = positionSizeWithFees;
      calcs.profitIfTPHitWithFees = profitIfTPHitWithFees;
    }

    setCalculations(calcs);
  }, [accountSize, riskPercentage, slPercentage, rrRatio, includeFees, feesPercentage]);

  useEffect(() => {
    calculateRisk();
  }, [calculateRisk]);

  // --- Input Handlers ---
  const handleNumberInputChange = (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
    (value: string | number) => {
      if (value === '' || (typeof value === 'number' && !isNaN(value))) {
        setter(value);
      } else if (typeof value === 'string' && /^\d*\.?\d*$/.test(value)) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          setter(numValue);
        } else if (value === '') {
          setter('');
        }
      }
    };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };


  return (
    <Container size="lg" my="xl">
      <Stack gap="lg">
        <Title order={1} ta="center" mb="md">Risk Calculator</Title>
        
        <Alert color="blue" title="Risk Management" mb="md">
          Calculate position sizes and potential profits based on your risk management strategy. 
          Green values are editable inputs.
        </Alert>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper shadow="sm" p="lg" withBorder>
              <Title order={3} mb="md" c="blue">Risk Management</Title>
              <Stack gap="md">
                <NumberInput
                  label="Account size"
                  value={accountSize}
                  onChange={handleNumberInputChange(setAccountSize)}
                  placeholder="100,000"
                  min={1}
                  step={1000}
                  allowDecimal
                  decimalScale={2}
                  thousandSeparator=","
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="Risk per trade in account %"
                  value={riskPercentage}
                  onChange={handleNumberInputChange(setRiskPercentage)}
                  placeholder="2.00"
                  min={0.01}
                  max={100}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  suffix="%"
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="SL %"
                  value={slPercentage}
                  onChange={handleNumberInputChange(setSlPercentage)}
                  placeholder="3.00"
                  min={0.01}
                  max={100}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  suffix="%"
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="R:R"
                  value={rrRatio}
                  onChange={handleNumberInputChange(setRrRatio)}
                  placeholder="3.00"
                  min={0.1}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper shadow="sm" p="lg" withBorder>
              <Title order={3} mb="md" c="blue">Calculations</Title>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text>Risk in $</Text>
                  <Text fw={700}>
                    {calculations ? formatCurrency(calculations.riskInDollars) : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">= Account * Risk per trade in account %</Text>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text>Position size</Text>
                  <Text fw={700}>
                    {calculations ? formatCurrency(calculations.positionSize) : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">= Risk in $ / SL%</Text>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text>Profit if TP hit</Text>
                  <Text fw={700} c="green">
                    {calculations ? formatCurrency(calculations.profitIfTPHit) : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">= Risk * R:R</Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        <Divider my="xl" />

        <Paper shadow="sm" p="lg" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={3} c="blue">Risk calculator with fees (in/out, no maker&apos;s rebate)</Title>
            <Switch
              label="Include fees"
              checked={includeFees}
              onChange={(event) => setIncludeFees(event.currentTarget.checked)}
            />
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <NumberInput
                  label="Account size"
                  value={accountSize}
                  onChange={handleNumberInputChange(setAccountSize)}
                  placeholder="100,000"
                  min={1}
                  step={1000}
                  allowDecimal
                  decimalScale={2}
                  thousandSeparator=","
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="Risk per trade in account %"
                  value={riskPercentage}
                  onChange={handleNumberInputChange(setRiskPercentage)}
                  placeholder="0.50"
                  min={0.01}
                  max={100}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  suffix="%"
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="SL %"
                  value={slPercentage}
                  onChange={handleNumberInputChange(setSlPercentage)}
                  placeholder="3.00"
                  min={0.01}
                  max={100}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  suffix="%"
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
                <NumberInput
                  label="Fees %"
                  value={feesPercentage}
                  onChange={handleNumberInputChange(setFeesPercentage)}
                  placeholder="0.10"
                  min={0.01}
                  max={10}
                  step={0.01}
                  allowDecimal
                  decimalScale={2}
                  suffix="%"
                  disabled={!includeFees}
                  styles={{
                    input: { backgroundColor: includeFees ? '#e8f5e8' : undefined }
                  }}
                />
                <NumberInput
                  label="R:R"
                  value={rrRatio}
                  onChange={handleNumberInputChange(setRrRatio)}
                  placeholder="3.00"
                  min={0.1}
                  step={0.1}
                  allowDecimal
                  decimalScale={2}
                  styles={{
                    input: { backgroundColor: '#e8f5e8' }
                  }}
                />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text>Risk in $</Text>
                  <Text fw={700}>
                    {calculations ? formatCurrency(calculations.riskInDollars) : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">= Account * Risk per trade in account %</Text>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text>Position size</Text>
                  <Text fw={700}>
                    {calculations && includeFees && calculations.positionSizeWithFees 
                      ? formatCurrency(calculations.positionSizeWithFees) 
                      : calculations 
                      ? formatCurrency(calculations.positionSize) 
                      : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  = Risk in $ / (SL% {includeFees ? '+ 2 * fees%' : ''})
                </Text>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text>Profit if TP hit</Text>
                  <Text fw={700} c="green">
                    {calculations && includeFees && calculations.profitIfTPHitWithFees 
                      ? formatCurrency(calculations.profitIfTPHitWithFees) 
                      : calculations 
                      ? formatCurrency(calculations.profitIfTPHit) 
                      : '-'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">= Risk * R:R</Text>
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>

        <Card withBorder p="md">
          <Group gap="md">
            <Badge color="green" size="lg">Editable cells in green</Badge>
            <Text size="sm" c="dimmed">
              All green input fields are saved automatically and will persist between sessions
            </Text>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
};

export default RiskCalculator;