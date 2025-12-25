
import { GoogleGenAI } from "@google/genai";
import { CallRecord, CallStatus } from "../types";

export const getSalesInsights = async (history: CallRecord[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const stats = {
    total: history.length,
    answered: history.filter(c => c.status === CallStatus.ANSWERED).length,
    noAnswer: history.filter(c => c.status === CallStatus.NO_ANSWER).length,
    totalDuration: history.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0)
  };

  const prompt = `Você é um consultor sênior de vendas. Analise estes dados de desempenho do time:
  - Total de chamadas: ${stats.total}
  - Atendidas (Contato Efetivo): ${stats.answered}
  - Não atendidas: ${stats.noAnswer}
  - Tempo total de conversação: ${Math.floor(stats.totalDuration / 60)} minutos.

  Forneça 3 insights estratégicos curtos e motivadores em Português para o gestor.`;

  try {
    // Using gemini-3-pro-preview as this task involves complex reasoning and data analysis
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Direct access to .text property as per latest SDK guidelines
    return response.text || "Continue o excelente trabalho! A constância é a chave para converter mais leads.";
  } catch (error) {
    console.error("Erro ao obter insights da IA:", error);
    return "Mantenha o ritmo de chamadas para atingir suas metas diárias. Foco na conversão!";
  }
};
