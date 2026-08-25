import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_IDS, isCategoryId, requiredFields } from "@/lib/categories";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const SAMPLE_ROWS = 20;

const CONFIDENCE_THRESHOLD = 0.75;

function schemaDescription() {
  return CATEGORY_IDS.map((id) => {
    const def = CATEGORIES[id];
    const fields = def.fields
      .map((f) => `    - ${f.key} (${f.type}${f.required ? ", required" : ", optional"}): ${f.label}`)
      .join("\n");
    return `  "${id}":\n${fields}`;
  }).join("\n");
}

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
  const fileName = typeof body?.fileName === "string" ? body.fileName : "upload";
  const columns = Array.isArray(body?.columns) ? (body.columns as string[]) : [];
  const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : [];

  if (columns.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "File has no usable data" }, { status: 400 });
  }

  const sampleRows = rows.slice(0, SAMPLE_ROWS);

  const systemPrompt = `You classify uploaded pharmaceutical sales-ops spreadsheets for a dashboard called New Vision. \
Given a file's column headers and a small sample of rows, decide which one of four fixed categories the file belongs to, \
or "unknown" if none fit. Then map each of that category's internal fields to the source file's actual column name \
(the file's headers may use different wording, e.g. "Territory" instead of "Area" -- match by meaning, not exact text). \
If no source column matches a field, map it to null. Never invent data or guess wildly -- if you are not confident, \
say so honestly with a lower confidence score rather than forcing a category.

The four categories and their target fields are:
${schemaDescription()}

Always call the classify_file tool with your answer.`;

  const userPrompt = `File name: ${fileName}
Columns: ${JSON.stringify(columns)}
Sample rows (first ${sampleRows.length} of ${rows.length}): ${JSON.stringify(sampleRows)}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          name: "classify_file",
          description: "Report the detected category, confidence, reasoning, and column mapping for the uploaded file.",
          input_schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [...CATEGORY_IDS, "unknown"],
                description: "Which category this file's data belongs to.",
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "How confident you are in the category and mapping, from 0 to 1.",
              },
              reasoning: {
                type: "string",
                description: "One or two short sentences explaining the decision, for a non-technical user.",
              },
              column_mapping: {
                type: "object",
                description: "Maps each internal field key for the chosen category to the source file's column name, or null if unmatched.",
                additionalProperties: { type: ["string", "null"] },
              },
            },
            required: ["category", "confidence", "reasoning", "column_mapping"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "classify_file" },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      return NextResponse.json({ error: "Claude did not return a classification" }, { status: 502 });
    }

    const result = toolUse.input as {
      category: string;
      confidence: number;
      reasoning: string;
      column_mapping: Record<string, string | null>;
    };

    const category = isCategoryId(result.category) ? result.category : "unknown";
    const columnMapping = category === "unknown" ? {} : result.column_mapping ?? {};
    const missingRequired =
      category === "unknown"
        ? []
        : requiredFields(category)
            .filter((f) => !columnMapping[f.key])
            .map((f) => f.key);

    const needsConfirmation =
      category === "unknown" ||
      result.confidence < CONFIDENCE_THRESHOLD ||
      missingRequired.length > 0;

    return NextResponse.json({
      category,
      confidence: result.confidence,
      reasoning: result.reasoning,
      columnMapping,
      missingRequired,
      needsConfirmation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
