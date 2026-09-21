import { useUser } from "./clerk.js";

export function useIsAdmin() {
  const { user } = useUser();
  return user?.publicMetadata?.role === "admin";
}
