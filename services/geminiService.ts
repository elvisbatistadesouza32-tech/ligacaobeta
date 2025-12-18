
import { GoogleGenAI } from "@google/genai";
import { CallRecord, CallStatus } from "../types";

export const getSalesInsights = async (history: CallRecord[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const stats = {
    total: history.length,
    answered: history.filter(c => c.status === CallStatus.ANSWERED).length,
    noAnswer: history.filter(c => c.status === CallStatus.NO_ANSWER).length,
    avgDuration: history.length > 0 ? (history.reduce((acc, curr) => acc + curr.durationSeconds, 0) / history.length).toFixed(1) : 0
  };

  const prompt = `Analise os seguintes dados de chamadas de um time comercial e forneça 3 recomendações curtas em Português para melhorar a performance. 
  Dados: Total de chamadas: ${stats.total}, Atendidas: ${stats.answered}, Não atendidas: ${stats.noAnswer}, Duração média: ${stats.avgDuration} segundos.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Erro ao obter insights da IA:", error);
    return "Mantenha o ritmo de chamadas para atingir suas metas diárias.";
  }
};
