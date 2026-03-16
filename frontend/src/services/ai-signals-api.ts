import { apiClient } from "@/lib/api-client";

export interface AiModelResult {
  model: string;
  provider: string;
  direction: string | null;
  confidence: string | null;
  reasons: string[];
  support: number | null;
  resistance: number | null;
  watchFor: string | null;
  error: string | null;
  latencyMs: number;
}

export interface AiSentimentResponse {
  generatedAt: string;
  niftyLtp: number;
  bankNiftyLtp: number;
  niftyPcr: number;
  models: AiModelResult[];
}

export async function fetchAiSentiment(): Promise<AiSentimentResponse> {
  const res = await apiClient.get<AiSentimentResponse>("/api/ai/market-sentiment");
  return res.data;
}
