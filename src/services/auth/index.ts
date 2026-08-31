import { cloudAuthService } from "./cloud-auth.adapter";
import type { AuthService } from "./auth-service";

/** Single configured auth service instance used across the app. */
export const authService: AuthService = cloudAuthService;

export type { AuthService, AuthUser, SignInInput, SignUpInput, AuthEvent } from "./auth-service";
