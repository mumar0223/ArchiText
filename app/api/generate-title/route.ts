import { NextResponse } from "next/server";
import { runAIModel } from "@/lib/ai-provider";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    const provider = process.env.AI_PROVIDER || "deepseek";
    const modelId =
      process.env.DEEPSEEK_MODEL_ID ||
      process.env.NEXT_PUBLIC_DEEPSEEK_MODEL_ID ||
      "deepseek-chat";

    const systemInstruction = `You are a professional system architect naming agent.
Given a user's initial system architecture prompt, generate a concise, clean, high-level project title (2 to 5 words maximum).
Do NOT use quotes, markdown formatting, or trailing period. Return ONLY the plain text title.
Example inputs & outputs:
Input: "Design a real time chat app with web sockets and redis" -> Output: Real-Time WebSocket Chat System
Input: "I want a microservices ecommerce platform with stripe payment" -> Output: E-Commerce Microservices Platform
Input: "Create a simple blog backend" -> Output: Blog Service Architecture`;

    const titleText = await runAIModel(
      provider,
      modelId,
      systemInstruction,
      prompt,
    );

    const cleanTitle = titleText
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "");

    return NextResponse.json({ title: cleanTitle || "Architecture Blueprint" });
  } catch (err: any) {
    console.error("[GENERATE TITLE API ERROR]:", err);
    return NextResponse.json(
      { title: "Architecture Blueprint" },
      { status: 500 },
    );
  }
}
