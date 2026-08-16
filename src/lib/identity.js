import { useUser } from "@clerk/clerk-react";

export function useDisplayName() {
  const { user } = useUser();
  if (!user) return null;
  const nickname = user.unsafeMetadata?.nickname?.trim();
  const showNicknameOnly = !!user.unsafeMetadata?.showNicknameOnly;
  const fullName = user.fullName || user.primaryEmailAddress?.emailAddress || "Signed-in user";
  if (nickname && showNicknameOnly) return nickname;
  if (nickname) return `${fullName} (${nickname})`;
  return fullName;
}
