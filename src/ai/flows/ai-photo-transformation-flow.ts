'use server';
/**
 * @fileOverview A Genkit flow for transforming an uploaded portrait photo into a passport-compliant photo,
 * with optional professional clothing overlays and customizable background color.
 *
 * - transformPhoto - A function that handles the AI photo transformation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiPhotoTransformationInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A portrait photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  coatStyle: z
    .enum(['none', 'suit', 'blazer', 'overcoat'])
    .optional()
    .describe('The professional clothing style to overlay on the subject.'),
  backgroundColor: z
    .string()
    .optional()
    .default('#FFFFFF')
    .describe('The hex color code or color name for the background.'),
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
  input: {
    schema: AiPhotoTransformationInputSchema.extend({
      coatInstructions: z.string().optional(),
    }),
  },
  model: 'googleai/gemini-2.5-flash-image',
  config: {
    // IMPORTANT: Both TEXT and IMAGE are required for the gemini-2.5-flash-image model to function as a transformer
    responseModalities: ['TEXT', 'IMAGE'],
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  },
  prompt: `Analyze the uploaded portrait image of a person and convert it into a professional passport-style photo.

Requirements:
- Detect and center the face with proper alignment (eyes level, head straight).
- Preserve the subject's original facial expression, identity, and all natural features exactly. Do NOT alter face shape, eyes, nose, or mouth.
- Replace the background with a clean, uniform {{{backgroundColor}}} background, evenly lit with no shadows or gradients.

{{#if coatInstructions}}
- CLOTHING TRANSFORMATION: {{{coatInstructions}}}
{{/if}}

- Enhance image quality:
  - Reduce noise and blur from low-quality uploads
  - Sharpen facial details naturally
  - Improve lighting balance and correct exposure
  - Remove harsh shadows and overexposed highlights
- Apply subtle, natural skin retouching:
  - Remove temporary blemishes, glare, or shine
  - Keep natural skin texture (avoid over-smoothing)
- Upscale the image to high resolution while maintaining realism.
- Ensure color accuracy and natural skin tones.
- Format the image to passport standards:
  - Head centered and properly sized
  - Neutral background
- Output a clean, professional, print-ready passport photo.

Important:
- Do NOT stylize, beautify excessively, or modify identity.
- The final image must look realistic and compliant with official passport photo guidelines.

Input Photo: {{media url=photoDataUri}}`,
});

const aiPhotoTransformationFlow = ai.defineFlow(
  {
    name: 'aiPhotoTransformationFlow',
    inputSchema: AiPhotoTransformationInputSchema,
    outputSchema: AiPhotoTransformationOutputSchema,
  },
  async (input) => {
    let coatInstructions = '';

    if (input.coatStyle === 'suit') {
      coatInstructions =
        'Seamlessly overlay a dark, professionally tailored navy blue wool blend suit jacket with subtle lapels, worn over a crisp white collared shirt and a simple, dark tie. The jacket fits perfectly and is neatly pressed.';
    } else if (input.coatStyle === 'blazer') {
      coatInstructions =
        'Seamlessly overlay a well-structured, dark charcoal grey textured blazer over a simple, elegant dark crewneck top. The blazer has defined shoulders and neat lapels, sitting flat against the torso.';
    } else if (input.coatStyle === 'overcoat') {
      coatInstructions =
        'Seamlessly overlay a high-quality, dense black trench-style coat with a neatly structured collar and a hidden placket, layered over a simple dark turtleneck. The coat fits snugly and professionally.';
    }

    try {
      const response = await passportPhotoPrompt({
        ...input,
        coatInstructions,
      });

      const mediaPart = response.media?.[0];
      if (!mediaPart || !mediaPart.url) {
        throw new Error('AI failed to generate the processed image. Please try again with a different photo.');
      }
      
      return { processedPhotoDataUri: mediaPart.url };
    } catch (error: any) {
      const errorMsg = error.message || '';
      
      // Handle the "limit: 0" case which indicates regional/tier restrictions
      if (errorMsg.includes('limit: 0')) {
        throw new Error('This AI model is restricted in your region (limit: 0). If you are in the EU/UK, some experimental Gemini features may be unavailable. Try checking your Gemini API console at ai.google.dev or ensure your project has high-tier access enabled.');
      }

      // Handle general quota and rate limit errors
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('AI processing quota exceeded. Please wait a moment and try again.');
      }
      
      throw error;
    }
  }
);

export async function transformPhoto(input: AiPhotoTransformationInput): Promise<AiPhotoTransformationOutput> {
  return aiPhotoTransformationFlow(input);
}