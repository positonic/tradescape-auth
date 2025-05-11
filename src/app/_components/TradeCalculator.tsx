'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Title, Stack, NumberInput, Text, Alert, Paper, Group } from '@mantine/core';

// --- Configuration for localStorage ---
const ACCOUNT_SIZE_KEY = 'tradeCalculator_accountSize_v1';
const MAX_RISK_PERCENTAGE_KEY = 'tradeCalculator_maxRiskPercentage_v1';

// --- Interfaces ---
interface TradeCalculations {
    maxMonetaryRiskPerTrade: number;
    riskPerUnit: number;
    positionSize: number | string;
    potentialProfit: number;
    potentialLoss: number;
    riskToRewardRatio: number | string;
    tradeDirection?: 'LONG' | 'SHORT';
}

const TradeCalculator: React.FC = () => {
    // --- Saved Settings State ---
    const [accountSize, setAccountSize] = useState<number | ''>(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(ACCOUNT_SIZE_KEY) : null;
        return saved ? parseFloat(saved) : 4300; // Default account size
    });
    const [maxRiskPercentage, setMaxRiskPercentage] = useState<number | ''>(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(MAX_RISK_PERCENTAGE_KEY) : null;
        return saved ? parseFloat(saved) : 1; // Default 1% risk
    });

    // --- Trade Input State ---
    const [entryPriceStr, setEntryPriceStr] = useState<string>('');
    const [stopLossPriceStr, setStopLossPriceStr] = useState<string>('');
    const [targetPriceStr, setTargetPriceStr] = useState<string>('');

    // --- Calculated Values State ---
    const [calculations, setCalculations] = useState<Partial<TradeCalculations>>({});
    const [error, setError] = useState<string>('');
    const [tradeDirection, setTradeDirection] = useState<'LONG' | 'SHORT' | null>(null);

    // --- Effects for localStorage ---
    useEffect(() => {
        if (typeof window !== 'undefined' && accountSize !== '') {
            localStorage.setItem(ACCOUNT_SIZE_KEY, accountSize.toString());
        }
    }, [accountSize]);

    useEffect(() => {
        if (typeof window !== 'undefined' && maxRiskPercentage !== '') {
            localStorage.setItem(MAX_RISK_PERCENTAGE_KEY, maxRiskPercentage.toString());
        }
    }, [maxRiskPercentage]);

    // --- Calculation Logic ---
    const calculateTradeParams = useCallback(() => {
        setError('');
        setTradeDirection(null);
        const ep = parseFloat(entryPriceStr);
        const slp = parseFloat(stopLossPriceStr);
        const tp = parseFloat(targetPriceStr);

        if (accountSize === '' || isNaN(Number(accountSize)) || Number(accountSize) <= 0) {
            setError('Account size must be a positive number.');
            setCalculations({});
            return;
        }
        if (maxRiskPercentage === '' || isNaN(Number(maxRiskPercentage)) || Number(maxRiskPercentage) <= 0 || Number(maxRiskPercentage) > 100) {
            setError('Max risk percentage must be between 0 (exclusive) and 100 (inclusive).');
            setCalculations({});
            return;
        }

        const currentMaxMonetaryRisk = Number(accountSize) * (Number(maxRiskPercentage) / 100);
        const calcs: Partial<TradeCalculations> = {
             maxMonetaryRiskPerTrade: parseFloat(currentMaxMonetaryRisk.toFixed(2))
        };

        if (entryPriceStr === '' || stopLossPriceStr === '') {
            setCalculations(calcs); // Only show max monetary risk if other inputs are missing
            setTradeDirection(null);
            return;
        }

        if (isNaN(ep) || isNaN(slp)) {
            setError('Entry and Stop Loss prices must be valid numbers.');
            setCalculations(calcs);
            setTradeDirection(null);
            return;
        }

        if (ep <= 0 || slp <= 0) {
            setError('Entry and Stop Loss prices must be positive.');
            setCalculations(calcs);
            setTradeDirection(null);
            return;
        }

        let inferredDirection: 'LONG' | 'SHORT' | null = null;
        if (ep > slp) {
            inferredDirection = 'LONG';
        } else if (slp > ep) {
            inferredDirection = 'SHORT';
        } else { // ep === slp
            setError('Entry Price and Stop Loss Price cannot be the same.');
            setCalculations(calcs);
            setTradeDirection(null);
            return;
        }
        setTradeDirection(inferredDirection);
        calcs.tradeDirection = inferredDirection;

        const riskPerUnitVal = inferredDirection === 'LONG' ? ep - slp : slp - ep;
        calcs.riskPerUnit = parseFloat(riskPerUnitVal.toFixed(Math.max(2, (entryPriceStr.split('.')[1]?.length ?? 0), (stopLossPriceStr.split('.')[1]?.length ?? 0))));

        if (riskPerUnitVal <= 0) { // Should be caught by previous checks
            setCalculations(calcs);
            return;
        }

        const positionSizeVal = currentMaxMonetaryRisk / riskPerUnitVal;
        calcs.positionSize = parseFloat(positionSizeVal.toFixed(6)); // Allow fractional for crypto
        calcs.potentialLoss = parseFloat((riskPerUnitVal * positionSizeVal).toFixed(2)); // This is effectively the maxMonetaryRisk

        if (targetPriceStr !== '' && !isNaN(tp) && tp > 0) {
            if (inferredDirection === 'LONG') {
                if (tp <= ep) {
                    setError(prevError => (prevError ? prevError + ' ' : '') + 'Warning: For a LONG trade, Target Price should be above Entry Price.');
                    calcs.riskToRewardRatio = 'N/A (Target <= Entry)';
                    calcs.potentialProfit = 0;
                } else {
                    const profitPerUnit = tp - ep;
                    calcs.potentialProfit = parseFloat((profitPerUnit * positionSizeVal).toFixed(2));
                    if (riskPerUnitVal > 0) {
                         const rrr = profitPerUnit / riskPerUnitVal;
                         calcs.riskToRewardRatio = parseFloat(rrr.toFixed(2));
                    } else {
                        calcs.riskToRewardRatio = 'N/A';
                    }
                }
            } else { // SHORT trade
                if (tp >= ep) {
                    setError(prevError => (prevError ? prevError + ' ' : '') + 'Warning: For a SHORT trade, Target Price should be below Entry Price.');
                    calcs.riskToRewardRatio = 'N/A (Target >= Entry)';
                    calcs.potentialProfit = 0;
                } else {
                    const profitPerUnit = ep - tp;
                    calcs.potentialProfit = parseFloat((profitPerUnit * positionSizeVal).toFixed(2));
                    if (riskPerUnitVal > 0) {
                        const rrr = profitPerUnit / riskPerUnitVal;
                        calcs.riskToRewardRatio = parseFloat(rrr.toFixed(2));
                    } else {
                        calcs.riskToRewardRatio = 'N/A';
                    }
                }
            }
        } else if (targetPriceStr !== '') { // TP is entered but not valid number or not > 0
             setError(prevError => (prevError ? prevError + ' ' : '') + 'Target price must be a positive number.');
        }


        setCalculations(calcs);

    }, [accountSize, maxRiskPercentage, entryPriceStr, stopLossPriceStr, targetPriceStr]);


    useEffect(() => {
        calculateTradeParams();
    }, [calculateTradeParams]);


    // --- Input Handlers ---
    const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
        (value: string | number) => {
            setter(String(value));
        };

    const handleSettingsInputChange = (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
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


    // --- Styling (Inline for simplicity - replace with your preferred styling solution) ---
    // Removed inline styles as Mantine components will be used

    return (
        <Container size="sm" my="xl">
            <Stack gap="lg">
                <Title order={2} ta="center">Trade Risk & Position Calculator</Title>

                {error && <Alert title="Error" color="red" withCloseButton onClose={() => setError('')}>{error}</Alert>}

                <Paper shadow="xs" p="md" withBorder>
                    <Stack>
                        <Title order={3} >Account Settings</Title>
                        <NumberInput
                            label="Account Size ($):"
                            id="accountSize"
                            value={accountSize}
                            onChange={handleSettingsInputChange(setAccountSize)}
                            placeholder="e.g., 10000"
                            min={0.01}
                            step={100}
                            allowDecimal
                            decimalScale={2}
                        />
                        <NumberInput
                            label="Max Risk per Trade (%):"
                            id="maxRiskPercentage"
                            value={maxRiskPercentage}
                            onChange={handleSettingsInputChange(setMaxRiskPercentage)}
                            placeholder="e.g., 1 (for 1%)"
                            min={0.01}
                            max={100}
                            step={0.1}
                            allowDecimal
                            decimalScale={2}
                        />
                    </Stack>
                </Paper>

                <Paper shadow="xs" p="md" withBorder>
                    <Stack>
                        <Title order={3}>Trade Inputs</Title>
                        {tradeDirection && (
                            <Text ta="center" fw={700} c={tradeDirection === 'LONG' ? 'green' : 'red' }>
                                Inferred Trade Type: {tradeDirection}
                            </Text>
                        )}
                        <NumberInput
                            label="Entry Price ($):"
                            id="entryPrice"
                            value={entryPriceStr}
                            onChange={(val) => handleNumericInputChange(setEntryPriceStr)(val === undefined ? '' : String(val))}
                            placeholder="e.g., 100.50"
                            min={0.00000001} // Allow very small prices for crypto
                            step={0.01}
                            allowDecimal
                            decimalScale={8} // Allow more precision for crypto
                        />
                        <NumberInput
                            label="Stop Loss Price ($):"
                            id="stopLossPrice"
                            value={stopLossPriceStr}
                            onChange={(val) => handleNumericInputChange(setStopLossPriceStr)(val === undefined ? '' : String(val))}
                            placeholder="e.g., 99.00"
                            min={0.00000001}
                            step={0.01}
                            allowDecimal
                            decimalScale={8}
                        />
                        <NumberInput
                            label="Target Price (Take Profit) ($):"
                            id="targetPrice"
                            value={targetPriceStr}
                            onChange={(val) => handleNumericInputChange(setTargetPriceStr)(val === undefined ? '' : String(val))}
                            placeholder="e.g., 105.00 (optional)"
                            min={0.00000001}
                            step={0.01}
                            allowDecimal
                            decimalScale={8}
                        />
                    </Stack>
                </Paper>

                {Object.keys(calculations).length > 0 && (
                    <Paper shadow="xs" p="md" withBorder>
                        <Stack>
                        <Title order={3}>Calculated Trade Parameters:</Title>
                        {calculations.tradeDirection && (
                             <Text ta="center" fw={500} size="sm" style={{marginBottom: '10px'}}>
                                Calculations for a {calculations.tradeDirection} trade.
                            </Text>
                        )}
                        {calculations.maxMonetaryRiskPerTrade !== undefined && (
                            <Group justify="space-between">
                                <Text>Max Risk for this Trade:</Text>
                                <Text fw={700} c="blue">${calculations.maxMonetaryRiskPerTrade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </Group>
                        )}
                        {calculations.riskPerUnit !== undefined && calculations.riskPerUnit > 0 && (
                            <Group justify="space-between">
                               <Text>Risk per Unit/Token:</Text>
                               <Text fw={700} c="blue">${calculations.riskPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</Text>
                            </Group>
                        )}
                        {calculations.positionSize !== undefined && typeof calculations.positionSize === 'number' && calculations.positionSize > 0 && (
                            <Group justify="space-between">
                                <Text>Suggested Position Size:</Text>
                                <Text fw={700} c="blue">{calculations.positionSize.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })} units</Text>
                            </Group>
                        )}
                        {calculations.potentialLoss !== undefined && typeof calculations.positionSize === 'number' && calculations.positionSize > 0 && (
                             <Group justify="space-between">
                                <Text>Potential Loss:</Text>
                                <Text fw={700} c="blue">${calculations.potentialLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </Group>
                        )}
                        {calculations.potentialProfit !== undefined && typeof calculations.positionSize === 'number' && calculations.positionSize > 0 && (
                            <Group justify="space-between">
                                <Text>Potential Profit:</Text>
                                <Text fw={700} c="blue">${calculations.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </Group>
                        )}
                        {calculations.riskToRewardRatio !== undefined && typeof calculations.positionSize === 'number' && calculations.positionSize > 0 && (
                             <Group justify="space-between">
                                <Text>Risk/Reward Ratio:</Text>
                                <Text fw={700} c="blue">
                                    {typeof calculations.riskToRewardRatio === 'number'
                                        ? `1 : ${calculations.riskToRewardRatio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : calculations.riskToRewardRatio}
                                </Text>
                            </Group>
                        )}
                        </Stack>
                    </Paper>
                )}
            </Stack>
        </Container>
    );
};

export default TradeCalculator;