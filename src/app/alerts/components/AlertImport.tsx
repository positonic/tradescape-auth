"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import type { ParsedAlert } from "~/types/alertImport";

interface AlertImportProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AlertImport({ onClose, onSuccess }: AlertImportProps) {
  const [text, setText] = useState("");
  const [parsedAlerts, setParsedAlerts] = useState<ParsedAlert[]>([]);
  const [unparseable, setUnparseable] = useState<string[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"input" | "review" | "result">("input");

  const parseAlerts = api.alerts.parseAlerts.useMutation({
    onSuccess: (data) => {
      setParsedAlerts(data.alerts);
      setUnparseable(data.unparseable);
      // Auto-select all valid alerts
      setSelectedAlerts(
        new Set(data.alerts.filter((a) => a.isValid).map((a) => a.id))
      );
      setStep("review");
    },
  });

  const bulkCreate = api.alerts.bulkCreate.useMutation({
    onSuccess: (result) => {
      if (result.created > 0) {
        onSuccess();
      }
    },
  });

  const handleParse = () => {
    if (text.trim()) {
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
      bulkCreate.mutate({ alerts: alertsToCreate });
      setStep("result");
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
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">
            {step === "input" && "Import Alerts from Text"}
            {step === "review" && "Review Parsed Alerts"}
            {step === "result" && "Import Complete"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
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
                className="w-full h-64 bg-gray-800 text-white rounded-lg p-4 font-mono text-sm border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
              />
              <div className="text-gray-500 text-sm">
                <strong>Supported formats:</strong>
                <ul className="list-disc ml-5 mt-1">
                  <li>Price alerts: &quot;BTC touches 100k&quot;, &quot;ETH at 4000&quot;</li>
                  <li>
                    Candle alerts: &quot;4H close above&quot;, &quot;Daily close below&quot;
                  </li>
                  <li>Shorthand: 100k = 100,000 | 94.2k = 94,200</li>
                </ul>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {parsedAlerts.length > 0 && (
                <>
                  <div className="flex justify-between items-center">
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
                        className={`p-4 rounded-lg border ${
                          alert.isValid
                            ? selectedAlerts.has(alert.id)
                              ? "bg-gray-800 border-blue-500"
                              : "bg-gray-800/50 border-gray-700"
                            : "bg-red-900/20 border-red-800/50"
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-white">
                                {alert.pairSymbol ?? alert.coinSymbol}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                              <span className="text-white font-mono">
                                {parseFloat(alert.threshold).toLocaleString()}
                              </span>
                              <span
                                className={`text-xs ${getConfidenceColor(alert.confidence)}`}
                              >
                                ({alert.confidence})
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1 truncate">
                              {alert.originalText}
                            </p>
                            {alert.notes && (
                              <p className="text-gray-500 text-sm mt-1">
                                💡 {alert.notes}
                              </p>
                            )}
                            {!alert.isValid && (
                              <p className="text-red-400 text-sm mt-1">
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
                <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
                  <p className="text-yellow-400 font-medium mb-2">
                    Could not parse ({unparseable.length}):
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    {unparseable.map((line, i) => (
                      <li key={i} className="truncate">
                        • {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "result" && (
            <div className="text-center py-8">
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
                    <div className="text-red-400 text-sm mt-4">
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
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create {selectedAlerts.size} Alerts
              </button>
            </>
          )}

          {step === "result" && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
