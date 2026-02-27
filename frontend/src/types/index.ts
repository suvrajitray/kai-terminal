export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface BrokerInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  features: string[];
  connected: boolean;
}
