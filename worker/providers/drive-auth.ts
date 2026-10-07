import {
  googleConfigured,
  googleConnected,
  googleToken,
  googleOAuth,
  type GoogleEnv,
} from "./google-auth";
export { seal, unseal } from "../security";
export type DriveEnv = GoogleEnv;
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_READ_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";
export const driveConfigured = googleConfigured;
export const driveConnected = (env: GoogleEnv) => googleConnected(env, "drive");
export const driveToken = (env: GoogleEnv) => googleToken(env, "drive");
export const driveOAuth = googleOAuth;
