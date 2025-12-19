
import { GoogleGenAI, Type } from "@google/genai";
import { SMCZone, OHLCV, AIValidationResult, NewsItem } from "../types";

export class GeminiAIService {
  async validateSetup(zone: SMCZone, marketContext: OHLCV[]): Promise<AIValidationResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const recentPriceAction = marketContext.slice(-100);
      const systemInstruction = `
        Act as a Senior Quantitative Trader and SMC Expert. Your goal is to analyze OHLCV data and identify institutional footprints with mathematical precision.
        
        ### Analysis Framework:
        - Identify 'Liquidity Sweeps': Locate wicks that exceed previous swing Highs/Lows by X standard deviations.
        - Detect 'Order Blocks' (OB): Identify the last candle before a displacement move that breaks market structure.
        - Calculate 'Fair Value Gaps' (FVG): Identify 3-candle sequences where price skips a level.

        ### Strategy:
        Evaluate displacement, relative volume, and institutional mitigation.
      `;

      const prompt = `
        Analyze this ${zone.type} setup in ${zone.direction} direction.
        Zone Equilibrium: ${zone.equilibrium}
        Recent Data (JSON): ${JSON.stringify(recentPriceAction)}
        
        Return exactly:
        {
          "score": float (0-1),
          "reasoning": "SMC-focused technical logic",
          "confidence": "HIGH|MEDIUM|LOW",
          "suggestion": "Specific entry/exit tactical advice"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingBudget: 16000 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
              suggestion: { type: Type.STRING }
            },
            required: ["score", "reasoning", "confidence", "suggestion"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      return data as AIValidationResult;
    } catch (error) {
      console.error("AI Validation Error:", error);
      return { 
        score: 0.5, 
        reasoning: "Neural link interrupted. Defaulting to baseline structure analysis.", 
        confidence: "LOW", 
        suggestion: "Wait for order flow confirmation." 
      };
    }
  }

  async fetchNews(assetSymbol: string): Promise<NewsItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const prompt = `Fetch the latest high-impact institutional financial news for ${assetSymbol}. Format as JSON array.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                source: { type: Type.STRING },
                sentiment: { type: Type.STRING, enum: ["BULLISH", "BEARISH", "NEUTRAL"] }
              },
              required: ["title", "summary", "source", "sentiment"]
            }
          }
        }
      });

      const newsData = JSON.parse(response.text || '[]');
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      return newsData.map((item: any, index: number) => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        url: groundingChunks[index]?.web?.uri || 'https://www.reuters.com/finance',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
    } catch (error) {
      return [];
    }
  }
}
