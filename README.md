# PixelPass AI: Professional Passport Photo Editor

PixelPass AI is a high-performance, AI-powered web application built with Next.js 15 and Gemini 2.5. It allows users to transform casual portraits into professional, government-compliant passport photos in seconds.

## Features

- **AI Portrait Transformation**: Centers faces, aligns eyes, and ensures biometric compliance.
- **Background Removal & Replacement**: Automatically replaces any background with a clean, uniformly lit color.
- **Clothing Overlays**: Seamlessly add professional suits, blazers, or overcoats to your portrait.
- **Custom Sizing Engine**: Define and save custom photo dimensions in CM, IN, or PX.
- **4K Upscaling**: Enhances low-resolution uploads for high-quality printing.
- **Secure Persistence**: User preferences and custom sizes are saved securely via Firebase Authentication and Firestore.

## Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **AI Engine**: [Google Genkit](https://github.com/firebase/genkit) with Gemini 2.5 Flash
- **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Anonymous Auth)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Samyesudas/Passport-Size-Photo-AI.git
   cd Passport-Size-Photo-AI
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file and add your Gemini API key:
   ```env
   GOOGLE_GENAI_API_KEY=your_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## License

This project is licensed under the MIT License.
# Passport-Size-Photo-AI
