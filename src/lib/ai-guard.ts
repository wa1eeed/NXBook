// ============================================================
// AI guard — agents must run even before the platform/tenant AI
// keys are configured. aiConfigured() reports whether a real key
// exists (platform OR tenant BYO-key). safeGenerate() calls the
// metered AI service when possible, otherwise returns a provided
// template fallback so the agent flow stays observable end to end.
// ============================================================

import { prisma } from "@/lib/prisma"

function realKey(value: string | undefined | null): boolean {
  return !!value && !value.startsWith("TODO")
}

/** Platform has at least one usable provider key. */
export function platformAiConfigured(): boolean {
  return realKey(process.env.ANTHROPIC_API_KEY) || realKey(process.env.OPENAI_API_KEY)
}

/**
 * Whether this tenant can make a real AI call: either they brought
 * their own key, or the platform has keys and the tenant is on the
 * metered PLATFORM plan.
 */
export async function aiConfigured(businessId: string): Promise<boolean> {
  const config = await prisma.businessAIConfig.findUnique({ where: { businessId } })
  if (config?.keyType === "OWN_KEY") {
    return realKey(config.anthropicKey) || realKey(config.openaiKey)
  }
  return platformAiConfigured()
}

export interface SafeGenerateArgs {
  businessId: string
  agentType: string
  systemPrompt: string
  userPrompt: string
  tier?: "fast" | "smart"
  maxTokens?: number
  /** Used verbatim when AI is unavailable, so flows still produce output. */
  fallback: string
}

export interface SafeGenerateResult {
  text: string
  usedAI: boolean
  costSar: number
  inputTokens: number
  outputTokens: number
}

/**
 * Generate text via the metered AI service, degrading to the fallback
 * string when no key is configured or the call fails. Never throws —
 * agent execution should be resilient to AI/credit issues.
 */
export async function safeGenerate(
  args: SafeGenerateArgs,
): Promise<SafeGenerateResult> {
  const fallbackResult: SafeGenerateResult = {
    text: args.fallback,
    usedAI: false,
    costSar: 0,
    inputTokens: 0,
    outputTokens: 0,
  }

  if (!(await aiConfigured(args.businessId))) return fallbackResult

  try {
    // Dynamic import keeps the heavy SDKs out of edge bundles and only
    // loads them when a real call is actually about to happen.
    const { callAI } = await import("@/lib/ai")
    const res = await callAI({
      businessId: args.businessId,
      agentType: args.agentType,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      preferFast: args.tier !== "smart",
      maxTokens: args.maxTokens,
    })
    return {
      text: res.text || args.fallback,
      usedAI: true,
      costSar: res.costSar,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
    }
  } catch {
    return fallbackResult
  }
}
