import { useEffect, useState } from "react";
import { getProfile } from "@/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
