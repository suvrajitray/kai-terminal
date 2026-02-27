import http from "./http";

export interface UserProfile {
  name: string;
  email: string;
}

export const getProfile = async (): Promise<UserProfile> => {
  const res = await http.get<UserProfile>("/api/profile");
  return res.data;
};
