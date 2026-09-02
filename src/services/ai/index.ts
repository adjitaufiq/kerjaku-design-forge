import { cloudAiRepository } from "./cloud-ai.adapter";
import type { AiRepository } from "../domain/ai";

/** Single configured AI data layer instance used across the app. */
export const aiData: AiRepository = cloudAiRepository;

export type * from "../domain/ai";
