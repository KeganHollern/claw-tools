import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugins/types";

function getXaiKey(api: OpenClawPluginApi): string | undefined {
  const providers = api.config.providers as Record<string, any> | undefined;
  return providers?.xai?.apiKey || process.env.XAI_API_KEY;
}

export default definePluginEntry({
  id: "grok-imagine",
  name: "Grok Imagine",
  description: "Provides image and video generation tools via xAI's Grok Imagine model",
  register(api) {
    // 1. Image Generation Tool
    api.registerTool({
      name: "grok_imagine_image",
      description: "Generate an image from a text prompt using the Grok Imagine model.",
      parameters: Type.Object({
        prompt: Type.String({ description: "A detailed description of the image to generate" })
      }),
      async execute(_id, params) {
        const apiKey = getXaiKey(api);
        if (!apiKey) {
          throw new Error("xAI API key not found. Please bind the xAI provider or set XAI_API_KEY.");
        }

        const response = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "x-ai/grok-imagine-image-pro",
            prompt: params.prompt,
            n: 1,
            response_format: "url"
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`xAI API Error: ${response.status} ${response.statusText} - ${body}`);
        }

        const data = await response.json() as any;
        const imageUrl = data.data?.[0]?.url;

        if (!imageUrl) {
          throw new Error("No image URL returned from xAI API.");
        }

        return {
          content: [
            { type: "text", text: `Image generated successfully: ${imageUrl}` },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        };
      }
    });

    // 2. Video Generation Tool
    api.registerTool({
      name: "grok_imagine_video",
      description: "Generate a video from a text prompt using the Grok Imagine model.",
      parameters: Type.Object({
        prompt: Type.String({ description: "A detailed description of the video to generate" })
      }),
      async execute(_id, params) {
        const apiKey = getXaiKey(api);
        if (!apiKey) {
          throw new Error("xAI API key not found. Please bind the xAI provider or set XAI_API_KEY.");
        }

        const response = await fetch("https://api.x.ai/v1/video/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            prompt: params.prompt
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`xAI API Error: ${response.status} ${response.statusText} - ${body}`);
        }

        const data = await response.json() as any;
        const videoUrl = data.url || data.video_url || data.data?.[0]?.url;

        let successText = "Video generation request successful.";
        if (videoUrl) {
          successText += ` Video URL: ${videoUrl}`;
        } else if (data.id || data.job_id) {
          successText += ` Job ID: ${data.id || data.job_id}`;
        }
        successText += `\n\nRaw response: ${JSON.stringify(data, null, 2)}`;

        return {
          content: [
            { type: "text", text: successText }
          ]
        };
      }
    });
  }
});
