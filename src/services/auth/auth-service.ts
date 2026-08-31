/**
 * Provider-agnostic authentication contract.
 * Business logic and UI depend on this interface only — never on a backend SDK.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  workshopName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "OTHER";

export interface AuthService {
  getCurrentUser(): Promise<AuthUser | null>;
  signIn(input: SignInInput): Promise<AuthUser>;
  signUp(input: SignUpInput): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void;
}
