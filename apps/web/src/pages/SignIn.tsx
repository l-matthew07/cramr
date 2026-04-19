import { SignIn as ClerkSignIn } from "@clerk/clerk-react";

export function SignIn() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Cramr</h1>
          <p className="text-sm text-ink-400 mt-1">Multiplayer study accountability.</p>
        </div>
        <ClerkSignIn routing="path" path="/sign-in" />
      </div>
    </div>
  );
}
