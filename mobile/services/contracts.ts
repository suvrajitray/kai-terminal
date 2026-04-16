import { apiClient } from './api';

export interface ContractEntry {
  tradingSymbol: string; expiry: string; upstoxToken: string;
  zerodhaToken: string; strikePrice: number; instrumentType: 'CE' | 'PE';
}
export interface IndexContracts { index: string; contracts: ContractEntry[]; }

export async function fetchMasterContracts(): Promise<IndexContracts[]> {
  const res = await apiClient.get<IndexContracts[]>('/api/masterdata/contracts');
  return res.data;
}
