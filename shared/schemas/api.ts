import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "CONFLICT",
  "INSUFFICIENT_EVIDENCE",
  "HIGH_RISK_ROUTED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
  "BINDING_MISSING",
  "CSRF_FAILED",
  "TURNSTILE_FAILED",
  "PAYLOAD_TOO_LARGE",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const CreateSessionSchema = z.object({
  consentAnalytics: z.boolean().optional().default(false),
});

export const SaveAnswerSchema = z.object({
  value: z.string().min(1).max(200),
});

export const CompleteAssessmentSchema = z.object({
  confirm: z.literal(true),
});

export const CreatePlanSchema = z.object({
  readinessPublicId: z.string().min(8).max(64).optional(),
});

export const CompleteActionSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  note: z.string().max(500).optional(),
});

export const CreateChatSessionSchema = z.object({
  historyOptIn: z.boolean().optional().default(false),
  title: z.string().max(120).optional(),
});

export const ChatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  turnstileToken: z.string().max(2048).optional(),
});

export const FeedbackSchema = z.object({
  messagePublicId: z.string().min(8).max(64),
  helpful: z.boolean(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

export const AdminSourceCreateSchema = z.object({
  title: z.string().min(3).max(300),
  summary: z.string().max(2000).optional(),
  issuer: z.string().min(2).max(200),
  jurisdiction: z.string().min(2).max(10).default("VN"),
  documentType: z.enum([
    "guideline",
    "education",
    "policy",
    "lesson",
    "other",
  ]),
  language: z.string().min(2).max(10).default("vi"),
  category: z.string().min(2).max(80),
  pillar: z.enum(["health", "finance", "caregiving"]).optional(),
  estimatedReadingMinutes: z.number().int().min(1).max(120).optional(),
  originalUrl: z.string().url().optional(),
  publicationDate: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  reviewedText: z.string().max(200_000).optional(),
});

export const AdminIngestSchema = z.object({
  reviewedText: z.string().max(200_000).optional(),
});

export const AdminApproveSchema = z.object({
  approve: z.boolean(),
  reviewer: z.string().min(2).max(120),
});
