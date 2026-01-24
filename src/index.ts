import { Bot, webhookCallback, InputFile } from "grammy";

type Env = {
  AI: Ai;
  DB: D1Database;
  BOT_TOKEN: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const bot = new Bot(env.BOT_TOKEN);

    const CURRENT_MODEL = "@cf/bytedance/stable-diffusion-xl-lightning";
    const PROMPT_PREFIX = "anime style, high quality, masterpiece, ";

    // 3) "@cf/bytedance/stable-diffusion-xl-lightning",
    // 2) "@cf/lykon/dreamshaper-8-lcm",
    // 1) "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    
    // 2) "@cf/runwayml/stable-diffusion-v1-5-img2img",
    // 1) "@cf/runwayml/stable-diffusion-v1-5-inpainting",
    
    bot.command("start", async (ctx) => {
      const userId = ctx.from!.id;
      const username = ctx.from?.username || "unknown";
      const firstName = ctx.from?.first_name || "User";

      try {
        await env.DB.prepare(
          "INSERT INTO users (id, username, first_name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = ?, first_name = ?"
        )
          .bind(userId, username, firstName, username, firstName)
          .run();
        await ctx.reply(`Привет! Тестирую модель: ${CURRENT_MODEL}. Напиши описание для генерации.`);
      } catch (err) {
        console.error(err);
        await ctx.reply("Ошибка БД.");
      }
    });

    bot.on("message:text", async (ctx) => {
      const prompt = ctx.message.text;
      await ctx.reply("Генерирую...");

      try {
        const response = await env.AI.run(
          CURRENT_MODEL,
          {
            prompt: `${prompt}`,
          }
        );

        let imageBlob: Blob;
        if (response instanceof Object && 'image' in response) {
             const binaryString = atob((response as any).image);
             const bytes = new Uint8Array(binaryString.length);
             for (let i = 0; i < binaryString.length; i++) {
                 bytes[i] = binaryString.charCodeAt(i);
             }
             imageBlob = new Blob([bytes]);
        } else {
             imageBlob = response as unknown as Blob;
        }
        
        await ctx.replyWithPhoto(new InputFile(imageBlob as unknown as Blob));

      } catch (error) {
        console.error(error);
        await ctx.reply("Ошибка генерации.");
      }
    });

    bot.catch((err) => console.error(err));
    
    return webhookCallback(bot, "cloudflare-mod")(request);
  },
};
