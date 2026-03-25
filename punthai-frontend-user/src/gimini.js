import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. ดึง API Key จาก .env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// 2. เริ่มต้น Instance
const genAI = new GoogleGenerativeAI(apiKey);

// 3. กำหนด Model (แนะนำ gemini-1.5-flash เพราะเร็วและฟรี)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ฟังก์ชันสำหรับส่งข้อความไปหา AI
export const runGeminiTest = async (promptText) => {
  try {
    const result = await model.generateContent(promptText);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};