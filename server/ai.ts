import { GoogleGenAI, Type } from '@google/genai';
import { REPORT_CATEGORIES } from '../src/utils/civicRules';

export interface AiModerationAssistResult {
  available: boolean;
  disclaimer: string;
  suggestedCategory?: string;
  spamRisk?: 'low' | 'medium' | 'high';
  piiConcerns?: string[];
  duplicateSignals?: string;
  moderatorChecklist?: string[];
  error?: string;
}

export async function runModeratorAiAssist(input: {
  title: string;
  description: string;
  currentCategory: string;
  recentTitlesInDistrict: Array<{ id: string; title: string; generalized_location: string }>;
}): Promise<AiModerationAssistResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      available: false,
      disclaimer: 'AI assistance is optional. Human moderation is always required.',
      error: 'GEMINI_API_KEY is not configured in server secrets. Perform manual human review below.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        'You are an advisory triage assistant for human civic moderators on JanConnect.',
        'NEVER decide whether an allegation is factually true. Only assess category fit, spam signals, possible personal information exposure (phone numbers, Aadhaar, home addresses, minor details), and possible duplicate similarity.',
        `Allowed categories: ${REPORT_CATEGORIES.join(', ')}`,
        `Report Title: ${input.title}`,
        `Report Description: ${input.description}`,
        `Selected Category: ${input.currentCategory}`,
        `Recent Reports in District: ${JSON.stringify(input.recentTitlesInDistrict.slice(0, 12))}`,
      ].join('\n\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedCategory: { type: Type.STRING },
            spamRisk: { type: Type.STRING },
            piiConcerns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            duplicateSignals: { type: Type.STRING },
            moderatorChecklist: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['suggestedCategory', 'spamRisk', 'piiConcerns', 'duplicateSignals', 'moderatorChecklist'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      suggestedCategory?: string;
      spamRisk?: 'low' | 'medium' | 'high';
      piiConcerns?: string[];
      duplicateSignals?: string;
      moderatorChecklist?: string[];
    };

    return {
      available: true,
      disclaimer: 'Advisory AI triage only. AI never decides factual truth; human moderator approval is required.',
      suggestedCategory: parsed.suggestedCategory,
      spamRisk: parsed.spamRisk,
      piiConcerns: parsed.piiConcerns || [],
      duplicateSignals: parsed.duplicateSignals || 'No strong duplicate signal detected.',
      moderatorChecklist: parsed.moderatorChecklist || [],
    };
  } catch (err) {
    return {
      available: false,
      disclaimer: 'AI assistance unavailable. Human moderation is required.',
      error: `AI assist request failed: ${(err as Error).message}`,
    };
  }
}
