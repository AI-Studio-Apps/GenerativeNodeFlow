<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This will automatically set AI Models: 

- using Gemini (specifically the gemini-2.5-flash-image model) for generating and editing images.
- using Veo (specifically the veo-3.1-fast-generate-preview model) for generating videos ( NOT Free).

This contains everything you need to run your app locally.

View the app in Github Pages (requires Gemini API Key) : https://ai-studio-apps.github.io/GenerativeNodeFlow/

View the app in AI Studio: https://aistudio.google.com/apps/drive/1qLISjOuHyN53q77FUVNPLmrLlZ8auOHr

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## AI Model Configuration

This app allows you to configure different Gemini models for specific tasks (Text, Image, Video) via the **Settings** panel.

- **Independent Settings:** You can define a unique **API Key**, **Model Name** (e.g., `gemini-2.5-flash-image`, `veo-3.1-fast-generate-preview`), and **Base URL** for each modality using the tabbed interface.
- **Persistence:** Your configurations are saved automatically to your browser's Local Storage, preserving your setup between sessions.
- **Dynamic Execution:** The application dynamically selects the correct credentials and model version based on the active node type (Text Generator, Image Editor, or Video Generator).


> [!TIP]
> Open the app settings to specify the API Key, Model, and URL (local or cloud)   
> These settings are saved to your localstorage.

- Model for text.
- Model for generating and editing images.
- Model for generating videos.


## Using Google Gemini  

You only need one single API key (your Google GenAI / Gemini API key).

**Unified Access**: Both the Gemini and Veo models are accessed through the same Google GenAI SDK (@google/genai).

One Key: The specific API Key you provide in your .env file (GEMINI_API_KEY) authenticates your project with Google's services, granting you access to all available models (Gemini, Veo, Imagen, etc.) that your account is authorized to use.

> [!CAUTION]
> Note on Billing: While you use the same key, Veo (Video generation) is a premium feature. To use Veo models, the Google Cloud Project associated with your API key must usually have billing enabled (meaning it requires a paid tier), whereas some Gemini models have a free tier


## Test local build of `metadata.json`

This project builds in CI using `npm`. If you prefer `pnpm` for local development you may still use it, but CI runs `npm` for consistency across runners. You can enable `pnpm` locally using Corepack (optional) or install it globally.

### Quick commands (Windows / macOS / Linux)

Use `npm` locally to match CI. The following commands install dependencies, build the site, and generate `dist/metadata.json`.

PowerShell (Windows):

```powershell
# Install dependencies and build
npm install
npm run build

# Generate metadata.json into dist and view it
node scripts/generate-metadata.cjs
Get-Content .\dist\metadata.json -Raw
```

Bash (macOS / Linux):

```bash
# Install dependencies and build
npm install
npm run build

# Generate metadata.json into dist and view it
node scripts/generate-metadata.cjs
cat dist/metadata.json
```

> [!NOTE]
> CI uses `npm` for installs and builds. For deterministic CI installs, add and commit `package-lock.json` so the workflow can use `npm ci`.
