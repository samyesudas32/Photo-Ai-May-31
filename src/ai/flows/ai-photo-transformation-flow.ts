'use server';
/**
 * @fileOverview A Genkit flow for transforming an uploaded portrait photo into a passport-compliant photo.
 *
 * - transformPhoto - A function that handles the AI photo transformation process.
 * - AiPhotoTransformationInput - The input type for the transformPhoto function.
 * - AiPhotoTransformationOutput - The return type for the transformPhoto function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiPhotoTransformationInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A portrait photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AiPhotoTransformationInput = z.infer<typeof AiPhotoTransformationInputSchema>;

const AiPhotoTransformationOutputSchema = z.object({
  processedPhotoDataUri: z
    .string()
    .describe(
      "The transformed passport-compliant photo as a data URI that includes a MIME type and uses Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AiPhotoTransformationOutput = z.infer<typeof AiPhotoTransformationOutputSchema>;

const passportPhotoPrompt = ai.definePrompt({
  name: 'passportPhotoPrompt',
  input: { schema: AiPhotoTransformationInputSchema },
  // The output schema here primarily serves as documentation for the expected output.
  // For image generation, the actual image data will be in the `media` array of the response.
  output: { schema: AiPhotoTransformationOutputSchema },
  model: 'googleai/gemini-2.5-flash-image',
  config: {
    responseModalities: ['IMAGE'],
  },
  prompt: `Analyze the uploaded portrait image of a person and convert it into a professional passport-style photo.\n\nRequirements:\n- Detect and center the face with proper alignment (eyes level, head straight).\n- Preserve the subject's original facial expression, identity, and all natural features exactly. Do NOT alter face shape, eyes, nose, or mouth.\n- Replace the background with a clean, pure white background (#FFFFFF), evenly lit with no shadows or gradients.\n- Enhance image quality:\n  - Reduce noise and blur from low-quality uploads\n  - Sharpen facial details naturally\n  - Improve lighting balance and correct exposure\n  - Remove harsh shadows and overexposed highlights\n- Apply subtle, natural skin retouching:\n  - Remove temporary blemishes, glare, or shine\n  - Keep natural skin texture (avoid over-smoothing)\n- Upscale the image to high resolution (target: 4K quality) while maintaining realism.\n- Ensure color accuracy and natural skin tones.\n- Format the image to passport standards:\n  - Head centered and properly sized\n  - Neutral background\n  - No accessories or obstructions unless culturally required\n- Output a clean, professional, print-ready passport photo.\n\nImportant:\n- Do NOT stylize, beautify excessively, or modify identity.\n- The final image must look realistic and compliant with official passport photo guidelines.\n\nInput Photo: {{media url=photoDataUri}}`,
});

const aiPhotoTransformationFlow = ai.defineFlow(
  {
    name: 'aiPhotoTransformationFlow',
    inputSchema: AiPhotoTransformationInputSchema,
    outputSchema: AiPhotoTransformationOutputSchema,
  },
  async (input) => {
    const response = await passportPhotoPrompt(input);
    const mediaPart = response.media?.[0];
    if (!mediaPart || !mediaPart.url) {
      throw new Error('Failed to generate processed photo or no media part found.');
    }
    return { processedPhotoDataUri: mediaPart.url };
  }
);

export async function transformPhoto(input: AiPhotoTransformationInput): Promise<AiPhotoTransformationOutput> {
  return aiPhotoTransformationFlow(input);
}
