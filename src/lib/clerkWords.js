/* =============================================================================
   WHAT CLERK SAYS, IN THIS APP'S VOICE.
   -----------------------------------------------------------------------------
   Clerk's card carries its own header, and it changes at every step: "Check
   your email", "Enter your password", "Verify your email". Hiding it would
   hide those, so the header stays and becomes the page's one title. Only the
   two opening steps are reworded here. Every later step keeps Clerk's words,
   because they are the instructions.

   Passed to ClerkProvider, so it reaches every Clerk component. Nothing else
   in the app draws one of these two steps.
   ========================================================================= */
export const CLERK_WORDS = {
  signIn: {
    start: {
      title: "Welcome back",
      subtitle: "Your quizzes, bookmarks and squadron are where you left them.",
    },
  },
  signUp: {
    start: {
      title: "Join Wingman",
      subtitle: "Part-66 study, one module at a time: quizzes on the exam clock, study cards, and a Ready Room of people on the same module.",
    },
  },
};
