// ============================================================
// AI Service — Multi-model (Anthropic + OpenAI) + Credit billing
// ============================================================

import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { prisma } from "./prisma"
import { AIProvider } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"

export interface AICallParams {
  businessId: string
  agentType: string
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  preferFast?: boolean
}

export interface AIResult {
  text: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costSar: number
}

// ─── Model tiers ─────────────────────────────────────────

const MODELS = {
  anthropic: {
    fast: process.env.DEFAULT_MODEL_FAST ?? "claude-haiku-4-5",
    smart: process.env.DEFAULT_MODEL_SMART ?? "claude-sonnet-4-6",
  },
  openai: { fast: "gpt-4o-mini", smart: "gpt-4o" },
}

// ─── Cost calc (SAR) ─────────────────────────────────────

async function calcCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const cfg = await prisma.platformConfig.findFirst()
  if (!cfg) return 0
  const ip = provider === "anthropic" ? cfg.anthropicInputPrice : cfg.openaiInputPrice
  const op = provider === "anthropic" ? cfg.anthropicOutputPrice : cfg.openaiOutputPrice
  return Math.round(((inputTokens / 1000) * ip + (outputTokens / 1000) * op) * cfg.platformMargin * 1000) / 1000
}

// ─── Deduct credits ──────────────────────────────────────

async function deduct(businessId: string, costSar: number, meta: {
  provider: string; model: string; inputTokens: number
  outputTokens: number; agentType: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const acc = await tx.creditAccount.findUnique({ where: { businessId } })
    if (!acc) throw new Error("NO_CREDIT_ACCOUNT")
    const newBal = acc.balance - costSar
    await tx.creditAccount.update({ where: { businessId }, data: { balance: newBal, totalUsed: { increment: costSar } } })
    await tx.creditTx.create({
      data: {
        creditAccountId: acc.id, type: "USAGE", amount: -costSar, balanceAfter: newBal,
        description: `${meta.agentType} — ${meta.model}`,
        provider: meta.provider === "anthropic" ? AIProvider.ANTHROPIC : AIProvider.OPENAI,
        model: meta.model, inputTokens: meta.inputTokens, outputTokens: meta.outputTokens,
        agentType: meta.agentType as any,
      }
    })
  })
}

// ─── Main call ───────────────────────────────────────────

export async function callAI(params: AICallParams): Promise<AIResult> {
  const { businessId, agentType, systemPrompt, userPrompt, maxTokens = 500, preferFast = true } = params

  const cfg = await prisma.businessAIConfig.findUnique({ where: { businessId } })
  const useOwnKey = cfg?.keyType === "OWN_KEY"
  const provider = cfg?.preferredProvider?.toLowerCase() === "openai" ? "openai" : "anthropic"
  const model = preferFast ? MODELS[provider].fast : MODELS[provider].smart

  if (!useOwnKey) {
    const acc = await prisma.creditAccount.findUnique({ where: { businessId } })
    if (!acc || acc.balance < 0.005) throw new Error("INSUFFICIENT_CREDITS")
  }

  try {
    let text = "", inputTokens = 0, outputTokens = 0

    if (provider === "anthropic") {
      const apiKey = useOwnKey ? cfg!.anthropicKey! : process.env.ANTHROPIC_API_KEY!
      const client = new Anthropic({ apiKey })
      const res = await client.messages.create({
        model, max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })
      text = res.content[0].type === "text" ? res.content[0].text : ""
      inputTokens = res.usage.input_tokens
      outputTokens = res.usage.output_tokens
    } else {
      const apiKey = useOwnKey ? cfg!.openaiKey! : process.env.OPENAI_API_KEY!
      const client = new OpenAI({ apiKey })
      const res = await client.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      })
      text = res.choices[0]?.message?.content ?? ""
      inputTokens = res.usage?.prompt_tokens ?? 0
      outputTokens = res.usage?.completion_tokens ?? 0
    }

    const costSar = useOwnKey ? 0 : await calcCost(provider, inputTokens, outputTokens)
    if (!useOwnKey && costSar > 0) await deduct(businessId, costSar, { provider, model, inputTokens, outputTokens, agentType })

    return { text, provider, model, inputTokens, outputTokens, costSar }

  } catch (err: any) {
    Sentry.captureException(err, { extra: { businessId, agentType, provider, model } })
    throw err
  }
}
