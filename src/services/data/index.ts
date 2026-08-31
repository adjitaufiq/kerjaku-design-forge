import { cloudDataLayer } from "./cloud-data.adapter";
import type { DataLayer } from "../domain/repositories";

/** Single configured data layer instance used across the app. */
export const data: DataLayer = cloudDataLayer;

export type * from "../domain/repositories";
