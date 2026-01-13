
import { GoogleGenAI } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';

interface ModelConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
}

// Default configurations
const defaults = {
    text: { model: 'gemini-3-flash-preview' },
    image: { model: 'gemini-2.5-flash-image' },
    video: { model: 'veo-3.1-fast-generate-preview' },
    audio: { model: 'gemini-2.5-flash-native-audio-preview-12-2025' }
};

let configs: Record<string, ModelConfig> = {
    text: { apiKey: process.env.API_KEY || "", model: defaults.text.model, baseUrl: "" },
    image: { apiKey: process.env.API_KEY || "", model: defaults.image.model, baseUrl: "" },
    video: { apiKey: process.env.API_KEY || "", model: defaults.video.model, baseUrl: "" },
    audio: { apiKey: process.env.API_KEY || "", model: defaults.audio.model, baseUrl: "" }
};

export const updateConfig = (newConfigs: Record<string, ModelConfig>) => {
    configs = { ...configs, ...newConfigs };
};

const getClient = (type: 'text' | 'image' | 'video' | 'audio') => {
    const conf = configs[type];
    // Fallback to process.env.API_KEY if specific key is missing, but allow empty if that's what's passed (though API calls will fail)
    // Actually, if self-hosting, user must provide key.
    const apiKey = conf.apiKey || process.env.API_KEY || "PLACEHOLDER";
    
    const options: any = { apiKey };
    if (conf.baseUrl) {
        options.baseUrl = conf.baseUrl;
    }
    return new GoogleGenAI(options);
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A higher-order function that wraps an API call with retry logic.
 * Expects a function that returns a Promise.
 */
const withRetry = <T>(apiCall: () => Promise<T>): (() => Promise<T>) => {
    return async (): Promise<T> => {
        let lastError: any;
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                return await apiCall();
            } catch (error: any) {
                lastError = error;
                let isRateLimitError = false;

                if (error instanceof Error && error.message) {
                    try {
                        const errorDetails = JSON.parse(error.message);
                        if (errorDetails?.error?.code === 429 || errorDetails?.error?.status === 'RESOURCE_EXHAUSTED') {
                            isRateLimitError = true;
                        }
                    } catch (e) {
                        if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
                           isRateLimitError = true;
                        }
                    }
                }
                
                if (isRateLimitError) {
                    if (i < MAX_RETRIES - 1) {
                        const backoffTime = INITIAL_DELAY_MS * Math.pow(2, i);
                        const jitter = Math.random() * 1000;
                        const waitTime = backoffTime + jitter;
                        console.warn(`Rate limit exceeded. Retrying in ${Math.round(waitTime / 1000)}s... (Attempt ${i + 1}/${MAX_RETRIES})`);
                        await delay(waitTime);
                        continue;
                    } else {
                        console.error(`API call failed after ${MAX_RETRIES} attempts due to rate limiting.`);
                    }
                }
                
                throw lastError;
            }
        }
        throw lastError;
    };
};

const formatError = (error: any, context: string): string => {
    console.error(`Error in ${context}:`, error);
    let errorMessage = error instanceof Error ? error.message : String(error);
    try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError?.error?.message) {
            errorMessage = parsedError.error.message;
            if (parsedError.error.status) {
                errorMessage += ` (Status: ${parsedError.error.status})`;
            }
        }
    } catch (e) {
        // Not a JSON string
    }
    return `Error: ${errorMessage}`;
};


// Helper to convert File object to base64
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// Helper to convert base64 string to a generative part
const base64ToGenerativePart = (base64: string, mimeType: string) => {
    return {
        inlineData: { data: base64, mimeType },
    };
}


export const generateText = async (prompt: string): Promise<string> => {
    if (!prompt) return "Error: Prompt is empty.";
    try {
        const client = getClient('text');
        const apiCall = () => client.models.generateContent({
            model: configs.text.model || defaults.text.model,
            contents: prompt,
        });
        
        const response: GenerateContentResponse = await withRetry(apiCall)();
        return response.text || "No text generated.";
    } catch (error) {
        return formatError(error, "generateText");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    if (!prompt) return "Error: Prompt is empty.";
    try {
        const client = getClient('image');
        const apiCall = () => client.models.generateContent({
            model: configs.image.model || defaults.image.model,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {}
        });

        const response: GenerateContentResponse = await withRetry(apiCall)();

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                 const base64EncodeString: string = part.inlineData.data;
                 const mimeType = part.inlineData.mimeType || 'image/png';
                 return `data:${mimeType};base64,${base64EncodeString}`;
            }
        }
        
        return "Error: Image generation failed to produce an image part.";

    } catch (error) {
        return formatError(error, "generateImage");
    }
};

export const editImage = async (
    base64Image: string,
    mimeType: string,
    prompt: string
): Promise<{ newBase64Image: string | null; text: string | null }> => {
    if (!base64Image || !prompt) return { newBase64Image: null, text: "Error: Image or prompt is missing." };
    try {
        const client = getClient('image');
        const imagePart = base64ToGenerativePart(base64Image, mimeType);
        const textPart = { text: prompt };

        const apiCall = () => client.models.generateContent({
            model: configs.image.model || defaults.image.model,
            contents: { parts: [imagePart, textPart] },
        });

        const response: GenerateContentResponse = await withRetry(apiCall)();

        let newBase64Image: string | null = null;
        let text: string | null = null;

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    text = (text ? text + "\n" : "") + part.text;
                } else if (part.inlineData) {
                    newBase64Image = part.inlineData.data;
                }
            }
        }
        return { newBase64Image, text };

    } catch (error) {
        return { newBase64Image: null, text: formatError(error, "editImage") };
    }
};

export const executePreset = async (
    inputs: { data: string; mimeType: string }[],
    prompt: string
): Promise<{ newBase64Image: string | null; text: string | null }> => {
    if (inputs.length === 0 || !prompt) {
        return { newBase64Image: null, text: "Error: Image(s) or prompt is missing." };
    }
    try {
        const client = getClient('image');
        const imageParts = inputs.map(input => base64ToGenerativePart(input.data, input.mimeType));
        const textPart = { text: prompt };
        const allParts = [...imageParts, textPart];

        const apiCall = () => client.models.generateContent({
            model: configs.image.model || defaults.image.model,
            contents: { parts: allParts },
        });

        const response: GenerateContentResponse = await withRetry(apiCall)();

        let newBase64Image: string | null = null;
        let text: string | null = null;

        if (response.candidates?.[0]?.content?.parts) {
             for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    text = (text ? text + "\n" : "") + part.text;
                } else if (part.inlineData) {
                    newBase64Image = part.inlineData.data;
                }
            }
        }
        return { newBase64Image, text };

    } catch (error) {
        return { newBase64Image: null, text: formatError(error, "executePreset") };
    }
};


export const generateVideo = async (
    base64Image: string | null,
    mimeType: string | null,
    prompt: string,
    onProgress: (message: string) => void,
): Promise<string> => {
     if (!prompt) return "Error: Prompt is empty.";
    try {
        const client = getClient('video');
        onProgress("Starting video generation...");
        let operation;
        
        const videoModel = configs.video.model || defaults.video.model;

        if (base64Image && mimeType) {
            operation = await withRetry(() => client.models.generateVideos({
              model: videoModel,
              prompt,
              image: {
                imageBytes: base64Image,
                mimeType: mimeType,
              },
              config: { numberOfVideos: 1 }
            }))();
        } else {
             operation = await withRetry(() => client.models.generateVideos({
                model: videoModel,
                prompt,
                config: { numberOfVideos: 1 }
            }))();
        }
        
        onProgress("Video processing has started. This may take a few minutes...");
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            onProgress("Checking video status...");
            // getVideosOperation must be called on the client.operations
            operation = await withRetry(() => client.operations.getVideosOperation({ operation: operation }))();
        }

        onProgress("Video processing complete. Fetching video...");
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video URI not found in response.");
        }

        const apiKey = configs.video.apiKey || process.env.API_KEY || "";
        const response = await fetch(`${downloadLink}&key=${apiKey}`);
        const videoBlob = await response.blob();
        
        onProgress("Video fetched successfully.");
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        const errorMessage = formatError(error, "generateVideo");
        onProgress(errorMessage);
        return errorMessage;
    }
};

export const utils = {
    fileToGenerativePart,
    base64ToGenerativePart,
};
