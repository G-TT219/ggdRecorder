import logger from '../logger';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyze = async (filePath: string, apiKey: string): Promise<string> => {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');

  const ai = new GoogleGenAI({ apiKey });

  const myfile = await ai.files.upload({
    file: filePath,
    config: { mimeType: 'video/webm' },
  });

  let fileState = myfile.state;
  while (fileState === 'PROCESSING') {
    await sleep(2000);
    const freshFile = await ai.files.get({ name: myfile.name });
    fileState = freshFile.state;
    if (fileState === 'FAILED') throw new Error('Video processing failed');
  }

  logger.info('Video processing complete, requesting model');

  const prompt = '你是一个鹅鸭杀游戏高手...请根据录像提供分析。';

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: createUserContent([
      createPartFromUri(myfile.uri, myfile.mimeType),
      prompt
    ]),
  });

  ai.files.delete({ name: myfile.name });
  return response.text;
};
