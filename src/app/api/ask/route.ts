import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { summarizeDataset } from "@/lib/dataStats";
import { CATEGORIES, isCategoryId } from "@/lib/categories";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_ROWS_FOR_STATS = 3000;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const categoryRaw = typeof body?.category === "string" ? body.category : "";
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!question || !isCategoryId(categoryRaw)) {
    return NextResponse.json({ error: "Missing question or category" }, { status: 400 });
  }

  const def = CATEGORIES[categoryRaw];
  const fieldKeys = def.fields.map((f) => f.key);

  const { data: rows, error: fetchError } = await supabase
    .from(def.table)
    .select(fieldKeys.join(","))
    .order("updated_at", { ascending: false })
    .limit(MAX_ROWS_FOR_STATS);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      answer: `There's no ${def.label} data yet -- upload a file for this category first.`,
    });
  }

  const summary = summarizeDataset(fieldKeys, rows as unknown as Record<string, unknown>[]);

  const systemPrompt = `You are the New Vision data assistant, helping a sales manager understand their ${def.label} data. \
You are given the dataset's schema, per-field statistics, and a sample of rows (not the full dataset). \
Answer the user's question in plain, concise natural language. Use numbers from the statistics when possible. \
If the sample rows aren't enough to answer precisely, say so and give your best estimate from the aggregate stats. \
Never invent data that isn't present. Keep answers focused and skimmable (short paragraphs or bullet points).

Category: ${def.label}
Total rows: ${summary.rowCount}
Fields and stats: ${JSON.stringify(summary.columns)}
Sample rows (first ${summary.sampleRows.length}): ${JSON.stringify(summary.sampleRows)}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).flatMap((h: { question: string; answer: string }) => [
      { role: "user" as const, content: h.question },
      { role: "assistant" as const, content: h.answer },
    ]),
    { role: "user" as const, content: question },
  ];

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await supabase.from("queries").insert({
      user_id: user.id,
      category: categoryRaw,
      question,
      answer,
    });

    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
