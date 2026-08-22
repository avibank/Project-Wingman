import { useUser } from "@clerk/clerk-react";

export function useDisplayName() {
  const { user } = useUser();
  if (!user) return null;
  const showRealName = user.unsafeMetadata?.showRealName !== false;
  const fullName = user.fullName || user.primaryEmailAddress?.emailAddress || "Signed-in user";
  if (showRealName && user.fullName) return user.fullName;
  return user.username || fullName;
}
