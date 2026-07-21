import { NextResponse } from "next/server";
import { runAgentLoop, streamAgentResponse } from "@/lib/agent/ai-agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, document, stream, allowQuestions } = body;

    if (typeof document !== "string") {
      return NextResponse.json(
        { error: "Invalid architecture document provided" },
        { status: 400 },
      );
    }

    if (stream) {
      const result = await streamAgentResponse({
        messages: messages || [],
        document,
        allowQuestions: allowQuestions !== false,
      });

      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.fullStream) {
              const data = JSON.stringify(chunk) + "\n";
              controller.enqueue(encoder.encode(data));
            }
          } catch (err: any) {
            console.error("[STREAMING ERROR]:", err);
            const errData =
              JSON.stringify({
                type: "error",
                error: err.message || String(err),
              }) + "\n";
            controller.enqueue(encoder.encode(errData));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runAgentLoop({
      messages: messages || [],
      document,
      allowQuestions: allowQuestions !== false,
    });

    return NextResponse.json({
      text: result.text,
      document: result.updatedDocument,
      logs: result.logs,
      pendingQuestions: result.pendingQuestions,
    });
  } catch (err: any) {
    console.error("[API AGENT ERROR]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process AI agent request" },
      { status: 500 },
    );
  }
}
