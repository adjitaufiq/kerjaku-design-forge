import { cloudAiRepository } from "./cloud-ai.adapter";
import type { AiRepository } from "../domain/ai";

/** Single configured AI data layer instance used across the app. */
export const aiData: AiRepository = cloudAiRepository;

export { consultantData } from "./cloud-consultant.adapter";

export type * from "../domain/ai";
export { conceptData } from "./cloud-concept.adapter";
export type * from "../domain/concept";
