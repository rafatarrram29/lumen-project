import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { summarizeDataset } from "@/lib/dataStats";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

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
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : "";
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!question || !datasetId) {
    return NextResponse.json({ error: "Missing question or datasetId" }, { status: 400 });
  }

  const { data: dataset, error: fetchError } = await supabase
    .from("datasets")
    .select("id, name, columns, rows, row_count")
    .eq("id", datasetId)
    .single();

  if (fetchError || !dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const summary = summarizeDataset(
    dataset.columns as string[],
    dataset.rows as Record<string, unknown>[],
  );

  const systemPrompt = `You are Lumen, an AI data analyst helping a sales manager understand their spreadsheet. \
You are given the dataset's schema, per-column statistics, and a sample of rows (not the full dataset). \
Answer the user's question in plain, concise natural language. Use numbers from the statistics when possible. \
If the sample rows aren't enough to answer precisely, say so and give your best estimate from the aggregate stats. \
Never invent data that isn't present. Keep answers focused and skimmable (short paragraphs or bullet points).

Dataset name: ${dataset.name}
Total rows: ${summary.rowCount}
Columns and stats: ${JSON.stringify(summary.columns)}
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
      dataset_id: dataset.id,
      question,
      answer,
    });

    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
