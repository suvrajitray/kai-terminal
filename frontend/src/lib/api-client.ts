import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const accessToken = useBrokerStore.getState().getCredentials("upstox")?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (accessToken) config.headers["X-Upstox-Access-Token"] = accessToken;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(new Error(err.response?.data?.message ?? err.message)),
);
