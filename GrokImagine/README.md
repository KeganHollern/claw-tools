# Grok Imagine Plugin for OpenClaw

This plugin provides OpenClaw agents with text-to-image and text-to-video capabilities powered by xAI's Grok Imagine model.

When installed, your agents can use tools like `grok_imagine_image` and `grok_imagine_video` to spontaneously generate and return rich media from prompts.

## Prerequisites

1. **OpenClaw** installed and configured on your machine.
2. A valid **xAI API Key** configured in your OpenClaw provider settings.
   - The plugin automatically reads this key from `api.config.providers.xai.apiKey`.
   - Alternatively, you can set the `XAI_API_KEY` environment variable.

## Installation

Since this plugin is hosted as part of the `claw-tools` repository, you can easily install it by cloning the repository and registering the local path with OpenClaw.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/KeganHollern/claw-tools.git
   ```

2. **Navigate to the plugin directory:**

   ```bash
   cd claw-tools/GrokImagine
   ```

3. **Install dependencies and build the plugin:**

   ```bash
   npm install
   npm run build
   ```

4. **Install the plugin into OpenClaw:**
   Run the OpenClaw plugin installer from within the `GrokImagine` directory:

   ```bash
   openclaw plugins install .
   ```

   *(Alternatively, use `openclaw plugins install -l .` to install it as a symlink if you plan to modify the code).*

5. **Restart OpenClaw Gateway:**

   ```bash
   openclaw gateway restart
   ```

## Usage

Once installed and the gateway restarts, OpenClaw agents will have access to the new tools. You can test the integration by asking an agent:

> "Using your tools, please generate an image of a futuristic city skyline at sunset."

### Available Tools

- **`grok_imagine_image`**: Generates a high-quality image from a descriptive prompt using `x-ai/grok-imagine-image-pro`.
- **`grok_imagine_video`**: Generates a video from a text prompt.

## Troubleshooting

- **API Key Not Found**: Ensure you have successfully connected the xAI provider in OpenClaw, or that `XAI_API_KEY` is exported in the environment where the OpenClaw gateway runs.
- **Tools not showing up**: Run `openclaw plugins list` to verify that `@openclaw/grok-imagine` is loaded and `enabled: true`.
