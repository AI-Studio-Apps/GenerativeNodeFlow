
import { GoogleGenAI, Modality } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';

// Default configuration
let currentApiKey = process.env.API_KEY || "";
let currentBaseUrl = "";
let currentTextModel = 'gemini-3-flash-preview'; // Default text model

// Initialize the client dynamically
let ai = new GoogleGenAI({ apiKey: currentApiKey || "PLACEHOLDER" });

export const updateConfig = (apiKey: string, model: string, baseUrl?: string) => {
    currentApiKey = apiKey;
    currentTextModel = model || 'gemini-3-flash-preview';
    currentBaseUrl = baseUrl || "";
    
    const options: any = { apiKey: currentApiKey };
    if (currentBaseUrl) {
        options.baseUrl = currentBaseUrl;
    }
    ai = new GoogleGenAI(options);
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A higher-order function that wraps an API call with retry logic for rate limiting errors.
 */
const withRetry = <T extends (...args: any[]) => Promise<any>>(apiCall: (client: any, ...args: any[]) => Promise<any>): ((...args: any[]) => Promise<any>) => {
    return (async (...args: any[]): Promise<any> => {
        let lastError: any;
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                // Always use the current 'ai' instance
                return await apiCall(ai, ...args);
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
    });
};

/**
 * Parses potential JSON error messages from the Gemini API for better user feedback.
 */
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
        // Not a JSON string, use the message as is.
    }
    return `Error: ${errorMessage}`;
};

// Wrappers that inject the current 'ai' instance
const generateContentWrapped = withRetry((client, params) => client.models.generateContent(params));
const generateVideosWrapped = withRetry((client, params) => client.models.generateVideos(params));
const getVideosOperationWrapped = withRetry((client, params) => client.operations.getVideosOperation(params));


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
        const response: GenerateContentResponse = await generateContentWrapped({
            model: currentTextModel,
            contents: prompt,
        });
        return response.text || "No text generated.";
    } catch (error) {
        return formatError(error, "generateText");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    if (!prompt) return "Error: Prompt is empty.";
    try {
        // Using gemini-2.5-flash-image for generation via generateContent
        const response: GenerateContentResponse = await generateContentWrapped({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                // responseMimeType and responseSchema are NOT supported for nano banana
            }
        });

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
        const imagePart = base64ToGenerativePart(base64Image, mimeType);
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await generateContentWrapped({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
        });

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
        const imageParts = inputs.map(input => base64ToGenerativePart(input.data, input.mimeType));
        const textPart = { text: prompt };
        const allParts = [...imageParts, textPart];

        const response: GenerateContentResponse = await generateContentWrapped({
            model: 'gemini-2.5-flash-image',
            contents: { parts: allParts },
        });

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
        onProgress("Starting video generation...");
        let operation;
        
        if (base64Image && mimeType) {
            operation = await generateVideosWrapped({
              model: 'veo-3.1-fast-generate-preview',
              prompt,
              image: {
                imageBytes: base64Image,
                mimeType: mimeType,
              },
              config: { numberOfVideos: 1 }
            });
        } else {
             operation = await generateVideosWrapped({
                model: 'veo-3.1-fast-generate-preview',
                prompt,
                config: { numberOfVideos: 1 }
            });
        }
        
        onProgress("Video processing has started. This may take a few minutes...");
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            onProgress("Checking video status...");
            operation = await getVideosOperationWrapped({ operation: operation });
        }

        onProgress("Video processing complete. Fetching video...");
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video URI not found in response.");
        }

        const response = await fetch(`${downloadLink}&key=${currentApiKey}`);
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
