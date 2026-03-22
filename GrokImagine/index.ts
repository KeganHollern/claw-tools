// xai-imagine-plugin/src/index.ts
// OpenClaw plugin for xAI Grok Imagine (Image + Video)
// Compatible with latest released OpenClaw (pre-March 15 2026 Plugin SDK refactor)
// Fixed: added required 'label' field (mandatory in AgentTool) + full execute signature + details

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";

const XAI_BASE_URL = "https://api.x.ai/v1";

export default function register(api: OpenClawPluginApi) {
  // ====================== IMAGE GENERATION TOOL ======================
  api.registerTool({
    name: "xai_generate_image",
    label: "xAI Grok Imagine Image",
    description:
      "Generate one or more high-quality images using xAI Grok Imagine. Returns direct MEDIA URLs so Telegram displays them instantly.",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Detailed text prompt for the image",
      }),
      n: Type.Optional(
        Type.Integer({
          description: "Number of images (1-4)",
          minimum: 1,
          maximum: 4,
          default: 1,
        }),
      ),
      aspect_ratio: Type.Optional(
        Type.String({
          description: 'Aspect ratio e.g. "16:9", "1:1", "9:16"',
          default: "1:1",
        }),
      ),
    }),
    async execute(
      toolCallId: string,
      params: any,
      _signal?: AbortSignal,
      _onUpdate?: any,
    ) {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        api.logger.error("XAI_API_KEY environment variable is missing");
        return {
          content: [
            {
              type: "text",
              text: "❌ XAI_API_KEY environment variable is required. Run: openclaw config set XAI_API_KEY your_key",
            },
          ],
          details: { error: "missing_api_key" },
        };
      }

      api.logger.info(
        `Generating xAI image. Prompt: ${params.prompt}, N: ${params.n}`,
      );
      const response = await fetch(`${XAI_BASE_URL}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-imagine-image",
          prompt: params.prompt,
          n: params.n ?? 1,
          aspect_ratio: params.aspect_ratio,
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        api.logger.error(
          `xAI Image API error. Status: ${response.status}, Error: ${err}`,
        );
        throw new Error(`xAI Image API error (${response.status}): ${err}`);
      }

      const data = await response.json();
      const imageUrls: string[] =
        data.data?.map((item: any) => item.url).filter(Boolean) ?? [];

      api.logger.info(
        `xAI image generation successful. Count: ${imageUrls.length}`,
      );
      const mediaLines = imageUrls.map((url) => `MEDIA:${url}`).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `✅ Generated ${imageUrls.length} image(s) with xAI Grok Imagine:\n\n${mediaLines}`,
          },
        ],
        details: {
          provider: "xai",
          model: "grok-imagine-image",
          imagesGenerated: imageUrls.length,
          toolCallId,
        },
      };
    },
  });

  // ====================== VIDEO GENERATION TOOL ======================
  api.registerTool({
    name: "xai_generate_video",
    label: "xAI Grok Imagine Video",
    description:
      "Generate a short video clip using xAI Grok Imagine Video. Supports text-to-video and image-to-video. Returns MEDIA URL for native Telegram playback.",
    parameters: Type.Object({
      prompt: Type.String({
        description:
          "Detailed prompt describing the video (motion, style, audio hints)",
      }),
      duration_seconds: Type.Optional(
        Type.Integer({
          description: "Duration in seconds (1-15)",
          minimum: 1,
          maximum: 15,
          default: 8,
        }),
      ),
      aspect_ratio: Type.Optional(
        Type.String({
          description: 'Aspect ratio e.g. "16:9", "9:16"',
          default: "16:9",
        }),
      ),
      image_url: Type.Optional(
        Type.String({
          description: "Optional starting image URL for image-to-video mode",
        }),
      ),
    }),
    async execute(
      toolCallId: string,
      params: any,
      _signal?: AbortSignal,
      _onUpdate?: any,
    ) {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        api.logger.error("XAI_API_KEY environment variable is missing");
        return {
          content: [
            {
              type: "text",
              text: "❌ XAI_API_KEY environment variable is required.",
            },
          ],
          details: { error: "missing_api_key" },
        };
      }

      // 1. Start generation
      api.logger.info(
        `Starting xAI video generation. Prompt: ${params.prompt}, Duration: ${params.duration_seconds}`,
      );
      const startBody: any = {
        model: "grok-imagine-video",
        prompt: params.prompt,
        duration: params.duration_seconds ?? 8,
        aspect_ratio: params.aspect_ratio,
      };
      if (params.image_url) {
        startBody.image = { url: params.image_url };
      }

      const startRes = await fetch(`${XAI_BASE_URL}/videos/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(startBody),
      });

      if (!startRes.ok) {
        const err = await startRes.text();
        api.logger.error(`xAI Video start error. Error: ${err}`);
        throw new Error(`xAI Video start error: ${err}`);
      }

      const { request_id } = await startRes.json();
      api.logger.info(
        `xAI video generation started. Request ID: ${request_id}`,
      );

      // 2. Poll for completion (max ~3 minutes)
      let videoUrl: string | null = null;
      const MAX_POLLS = 36 * 2; // 5s * 36 = 6min
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        const pollRes = await fetch(
          `${XAI_BASE_URL}/videos/generations/${request_id}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        );

        const pollData = await pollRes.json();
        api.logger.info(
          `xAI video poll status. Request ID: ${request_id}, Status: ${pollData.status}`,
        );

        if (pollData.status === "completed" && pollData.video?.url) {
          videoUrl = pollData.video.url;
          api.logger.info(
            `xAI video generation completed. Request ID: ${request_id}`,
          );
          break;
        }
        if (pollData.status === "failed") {
          api.logger.error(
            `xAI video generation failed. Request ID: ${request_id}, Error: ${pollData.error}`,
          );
          throw new Error(
            `Video generation failed: ${pollData.error ?? "Unknown error"}`,
          );
        }
      }

      if (!videoUrl) {
        api.logger.info(
          `xAI video generation pending limit reached. Request ID: ${request_id}`,
        );
        return {
          content: [
            {
              type: "text",
              text: `⏳ Video generation started (ID: ${request_id}). It may take up to 3 minutes. Reply with the same prompt later to check status.`,
            },
          ],
          details: { status: "pending", request_id, toolCallId },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Video generated successfully with xAI Grok Imagine (${params.duration_seconds ?? 8}s):\n\nMEDIA:${videoUrl}`,
          },
        ],
        details: {
          provider: "xai",
          model: "grok-imagine-video",
          duration: params.duration_seconds ?? 8,
          toolCallId,
        },
      };
    },
  });
}
