import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const runGeminiTest = async (promptText) => {
  
  if (!apiKey) {
    throw new Error("ไม่พบ API Key! กรุณาเช็คไฟล์ .env ว่ามี VITE_GEMINI_API_KEY หรือไม่");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  try {
    const result = await model.generateContent(promptText);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};