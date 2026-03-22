import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createXai } from "@ai-sdk/xai";
import { experimental_generateImage as generateImage } from "ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";

function getXaiKey(api: OpenClawPluginApi): string | undefined {
  const providers = (api.config as any).providers as Record<string, any> | undefined;
  return providers?.xai?.apiKey || process.env.XAI_API_KEY;
}

const plugin = {
  id: "grok-imagine",
  name: "Grok Imagine",
  description: "Provides image and video generation tools via xAI's Grok Imagine model",
  register(api: OpenClawPluginApi) {
    // 1. Image Generation Tool
    api.registerTool({
      name: "grok_imagine_image",
      label: "Grok Imagine Image",
      description: "Generate an image from a text prompt using the Grok Imagine model.",
      parameters: Type.Object({
        prompt: Type.String({ description: "A detailed description of the image to generate" })
      }),
      async execute(_id: string, params: Record<string, any>) {
        const apiKey = getXaiKey(api);
        if (!apiKey) {
          throw new Error("xAI API key not found. Please bind the xAI provider or set XAI_API_KEY.");
        }

        const xai = createXai({ apiKey });
        const { image } = await generateImage({
            model: xai.image("grok-imagine-image"),
            prompt: params.prompt,
        });

        const outputPath = path.join(os.tmpdir(), `grok-image-${crypto.randomUUID()}.png`);
        fs.writeFileSync(outputPath, Buffer.from(image.base64, "base64"));
        
        return {
            content: "Image generated successfully. The image has been attached to the conversation.",
            attachments: [
                {
                    type: "image",
                    path: outputPath,
                    mimeType: "image/png"
                }
            ]
        } as any;
      }
    });

    // 2. Video Generation Tool
    api.registerTool({
      name: "grok_imagine_video",
      label: "Grok Imagine Video",
      description: "Generate a video from a text prompt using the Grok Imagine model.",
      parameters: Type.Object({
        prompt: Type.String({ description: "A detailed description of the video to generate" })
      }),
      async execute(_id: string, params: Record<string, any>) {
        const apiKey = getXaiKey(api);
        if (!apiKey) {
          throw new Error("xAI API key not found. Please bind the xAI provider or set XAI_API_KEY.");
        }

        const response = await fetch("https://api.x.ai/v1/videos/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "grok-imagine-video",
            prompt: params.prompt,
            duration: 10,
            aspect_ratio: "16:9",
            resolution: "720p"
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`xAI API Error: ${response.status} ${response.statusText} - ${body}`);
        }

        const { request_id } = await response.json() as any;
        if (!request_id) {
          throw new Error("No request_id returned from xAI Video API.");
        }

        let videoUrl = "";
        let finalData: any = {};

        // Polling loop
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const pollRes = await fetch(`https://api.x.ai/v1/videos/${request_id}`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
          });

          if (!pollRes.ok) {
            const body = await pollRes.text();
            throw new Error(`xAI Video Poll Error: ${pollRes.status} ${pollRes.statusText} - ${body}`);
          }

          finalData = await pollRes.json() as any;

          if (finalData.status === "done") {
            videoUrl = finalData.video?.url;
            break;
          } else if (finalData.status === "expired" || finalData.status === "failed") {
            throw new Error(`Video generation ${finalData.status}`);
          }
        }

        return {
          content: `Video generated successfully! URL: ${videoUrl}\nDuration: ${finalData.video?.duration}s`,
          attachments: [
            {
              type: "video",
              url: videoUrl,
              mimeType: "video/mp4"
            }
          ]
        } as any;
      }
    });
  }
};

export default plugin;
