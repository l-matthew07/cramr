import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setSocketTokenGetter, disconnectSocket } from "./socket";

type Getter = () => Promise<string | null>;

const TokenContext = createContext<Getter>(async () => null);

export function DevTokenProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setSocketTokenGetter(async () => null);
    return () => disconnectSocket();
  }, []);
  return (
    <TokenContext.Provider value={async () => null}>
      {children}
    </TokenContext.Provider>
  );
}

export function ClerkTokenProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const getter: Getter = async () => (await getToken()) ?? null;

  useEffect(() => {
    setSocketTokenGetter(getter);
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TokenContext.Provider value={getter}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokenGetter(): Getter {
  return useContext(TokenContext);
}
