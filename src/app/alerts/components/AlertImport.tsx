"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import type { ParsedAlert } from "~/types/alertImport";

interface AlertImportProps {
  onClose: () => void;
  onSuccess: () => void;
  initialText?: string;
}

export function AlertImport({
  onClose,
  onSuccess,
  initialText,
}: AlertImportProps) {
  const [text, setText] = useState(initialText ?? "");
  const [parsedAlerts, setParsedAlerts] = useState<ParsedAlert[]>([]);
  const [unparseable, setUnparseable] = useState<string[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"input" | "review" | "result">("input");
  const [parseError, setParseError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const autoParseTriggered = useRef(false);

  const parseAlerts = api.alerts.parseAlerts.useMutation({
    onSuccess: (data) => {
      setParsedAlerts(data.alerts);
      setUnparseable(data.unparseable);
      // Auto-select all valid alerts
      setSelectedAlerts(
        new Set(data.alerts.filter((a) => a.isValid).map((a) => a.id)),
      );
      setStep("review");
    },
    onError: (error) => {
      setParseError(error.message ?? "Failed to parse alerts");
    },
  });

  const bulkCreate = api.alerts.bulkCreate.useMutation({
    onSuccess: (result) => {
      if (result.created > 0) {
        onSuccess();
      }
      setStep("result");
    },
    onError: (error) => {
      setCreateError(error.message ?? "Failed to create alerts");
    },
  });

  // Auto-parse when initialText is provided
  useEffect(() => {
    if (initialText?.trim() && !autoParseTriggered.current) {
      autoParseTriggered.current = true;
      parseAlerts.mutate({ text: initialText.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  const handleParse = () => {
    if (text.trim()) {
      setParseError(null);
      parseAlerts.mutate({ text: text.trim() });
    }
  };

  const handleToggleAlert = (id: string) => {
    setSelectedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const validIds = parsedAlerts.filter((a) => a.isValid).map((a) => a.id);
    setSelectedAlerts(new Set(validIds));
  };

  const handleSelectNone = () => {
    setSelectedAlerts(new Set());
  };

  const handleCreate = () => {
    const alertsToCreate = parsedAlerts
      .filter((a) => selectedAlerts.has(a.id) && a.isValid && a.pairId !== null)
      .map((a) => ({
        pairId: a.pairId!,
        type: a.type,
        threshold: a.threshold,
        direction: a.direction,
        interval: a.interval,
      }));

    if (alertsToCreate.length > 0) {
      setCreateError(null);
      bulkCreate.mutate({ alerts: alertsToCreate });
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-green-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getDirectionColor = (direction: string) => {
    return direction === "ABOVE" ? "text-green-400" : "text-red-400";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-gray-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            {step === "input" && "Import Alerts from Text"}
            {step === "review" && "Review Parsed Alerts"}
            {step === "result" && "Import Complete"}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === "input" && (
            <div className="space-y-4">
              <p className="text-gray-300">
                Paste your trading analysis text below. AI will extract price
                and candle alerts automatically.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Example:
BTC 4H close ABOVE 100k confirms breakout
ETH price touches 4000 - major resistance
SOL BELOW 180 invalidates bullish structure
ETHBTC 4H close above 0.04 signals rotation`}
                className="h-64 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 p-4 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <div className="text-sm text-gray-500">
                <strong>Supported formats:</strong>
                <ul className="ml-5 mt-1 list-disc">
                  <li>
                    Price alerts: &quot;BTC touches 100k&quot;, &quot;ETH at
                    4000&quot;
                  </li>
                  <li>
                    Candle alerts: &quot;4H close above&quot;, &quot;Daily close
                    below&quot;
                  </li>
                  <li>Shorthand: 100k = 100,000 | 94.2k = 94,200</li>
                </ul>
              </div>
              {parseError && (
                <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-3 text-sm text-red-400">
                  ⚠️ {parseError}
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {parsedAlerts.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-300">
                      Found {parsedAlerts.length} alerts.{" "}
                      {parsedAlerts.filter((a) => a.isValid).length} valid.
                    </p>
                    <div className="space-x-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Select All
                      </button>
                      <span className="text-gray-600">|</span>
                      <button
                        onClick={handleSelectNone}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Select None
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parsedAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-lg border p-4 ${
                          alert.isValid
                            ? selectedAlerts.has(alert.id)
                              ? "border-blue-500 bg-gray-800"
                              : "border-gray-700 bg-gray-800/50"
                            : "border-red-800/50 bg-red-900/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAlerts.has(alert.id)}
                            onChange={() => handleToggleAlert(alert.id)}
                            disabled={!alert.isValid}
                            className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">
                                {alert.pairSymbol ?? alert.coinSymbol}
                              </span>
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  alert.type === "CANDLE"
                                    ? "bg-purple-900/50 text-purple-300"
                                    : "bg-blue-900/50 text-blue-300"
                                }`}
                              >
                                {alert.type}
                                {alert.interval && ` (${alert.interval})`}
                              </span>
                              <span
                                className={`font-medium ${getDirectionColor(alert.direction)}`}
                              >
                                {alert.direction}
                              </span>
                              <span className="font-mono text-white">
                                {parseFloat(alert.threshold).toLocaleString()}
                              </span>
                              <span
                                className={`text-xs ${getConfidenceColor(alert.confidence)}`}
                              >
                                ({alert.confidence})
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-gray-400">
                              {alert.originalText}
                            </p>
                            {alert.notes && (
                              <p className="mt-1 text-sm text-gray-500">
                                💡 {alert.notes}
                              </p>
                            )}
                            {!alert.isValid && (
                              <p className="mt-1 text-sm text-red-400">
                                ⚠️ {alert.validationError}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {unparseable.length > 0 && (
                <div className="mt-4 rounded-lg border border-yellow-800/50 bg-yellow-900/20 p-4">
                  <p className="mb-2 font-medium text-yellow-400">
                    Could not parse ({unparseable.length}):
                  </p>
                  <ul className="space-y-1 text-sm text-gray-400">
                    {unparseable.map((line, i) => (
                      <li key={i} className="truncate">
                        • {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {createError && (
                <div className="mt-4 rounded-lg border border-red-800/50 bg-red-900/20 p-3 text-sm text-red-400">
                  ⚠️ {createError}
                </div>
              )}
            </div>
          )}

          {step === "result" && (
            <div className="py-8 text-center">
              {bulkCreate.isPending ? (
                <div className="text-gray-300">Creating alerts...</div>
              ) : bulkCreate.data ? (
                <div className="space-y-4">
                  <div className="text-6xl">
                    {bulkCreate.data.failed === 0 ? "✅" : "⚠️"}
                  </div>
                  <div className="text-xl text-white">
                    Created {bulkCreate.data.created} alerts
                    {bulkCreate.data.failed > 0 && (
                      <span className="text-red-400">
                        {" "}
                        ({bulkCreate.data.failed} failed)
                      </span>
                    )}
                  </div>
                  {bulkCreate.data.errors.length > 0 && (
                    <div className="mt-4 text-sm text-red-400">
                      {bulkCreate.data.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-700 px-6 py-4">
          {step === "input" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim() || parseAlerts.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {parseAlerts.isPending ? "Parsing..." : "Parse Alerts"}
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <button
                onClick={() => setStep("input")}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedAlerts.size === 0 || bulkCreate.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create {selectedAlerts.size} Alerts
              </button>
            </>
          )}

          {step === "result" && (
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
