const {
    GoogleGenAI,
    createUserContent,
    createPartFromUri,
} = require("@google/genai");
const { setGlobalDispatcher, ProxyAgent } = require("undici");
const { config } = require("dotenv");
const logger = require("./logger");

config();

//全局fetch调用启用代理
const dispatcher = new ProxyAgent({ uri: new URL(process.env.https_proxy).toString() });
setGlobalDispatcher(dispatcher);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const analyze = async (path,apiKey) => {
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const myfile = await ai.files.upload({
            file: path,
            config: { mimeType: "video/webm" },
        });

        let fileState = myfile.state; // 获取当前状态
        // 只要状态是 "PROCESSING" 就一直等待
        while (fileState === "PROCESSING") {
            await sleep(2000);  // 等待 2 秒

            const freshFile = await ai.files.get({ name: myfile.name });
            fileState = freshFile.state;

            // 检查是否有错误状态
            if (fileState === "FAILED") {
                throw new Error("视频处理失败 (FAILED)，请检查视频格式是否受支持。");
            }
        }

        logger.info("视频处理完毕 (ACTIVE)，开始请求模型");

        const prompt = "你是一个鹅鸭杀游戏高手，你可以在游戏界面右上角的地图确认玩家的位置，你可以在游戏界面左上角获取玩家阵营和身份信息。"
            + "这里有一份地点名称列表供你参考：[祭坛，前堂，书房，礼堂，储物间，储物柜，奇珍异品收藏室，地牢，隧道，隧道入口，坑，实验室，锅炉房，走廊，雾洞]。"
            + "这是一局鹅鸭杀游戏的录像，请你简单描述被玩家操控的角色的主要行动轨迹，"
            + "以及在哪里什么时候遇上了什么玩家、以及这些玩家值得关注的行为。"
            + "并根据这些信息提供一个20s的会议发言稿，需要包括我的行动轨迹，遇上的人，和怀疑目标";
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: createUserContent([
                createPartFromUri(myfile.uri, myfile.mimeType),
                prompt
            ]),
        });
        ai.files.delete({ name: myfile.name });
        return response.text;
    } catch (e) {
        throw e;
    }
}

module.exports = { analyze };