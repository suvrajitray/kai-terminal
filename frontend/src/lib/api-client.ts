import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { isTokenExpired } from "@/lib/token-utils";
import { performLogout } from "@/lib/logout";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const accessToken = useBrokerStore.getState().getCredentials("upstox")?.accessToken;

  if (token) {
    if (isTokenExpired(token)) {
      performLogout();
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (accessToken) config.headers["X-Upstox-Access-Token"] = accessToken;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      performLogout();
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    return Promise.reject(new Error(err.response?.data?.message ?? err.message));
  },
);
