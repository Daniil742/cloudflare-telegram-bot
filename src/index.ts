import { Bot, webhookCallback, InputFile } from "grammy";

type Env = {
  AI: Ai;
  DB: D1Database;
  BOT_TOKEN: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const bot = new Bot(env.BOT_TOKEN);

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
        await ctx.reply("Привет! Напиши описание для генерации.");
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
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          {
            prompt: `anime style, high quality, masterpiece, ${prompt}`,
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
    const handler = webhookCallback(bot, "cloudflare");
    return handler(request);
  },
};
