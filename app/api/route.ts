import { groupSegmentsByTokenLength, parseStreamedResponse } from "@/lib/srt";
import { parseSegment } from "@/lib/client";
import OpenAI from "openai";
import { splitStringByRatios, tokenizeJapaneseText } from "@/lib/token_tools"

export const dynamic = 'force-dynamic' // defaults to auto

// The total number of tokens supported by OpenAI APIs is 4096 across all models.
// That means Output + Input + Prompt = 4096 tokens. Since our prompt is 50 tokens,
// and the output is 4.5 * input, we can calculate the maximum input length as:
// 4096 = 50 + 4.5 * Input + Input
// i.e. Input = 700 tokens maximum
// We use 4.5 * Input to consider the worst-case scenario where we're translating from
// English to Indian, which is the longest language in terms of token length.
const MAX_TOKENS_IN_SEGMENT = 700;
const MAX_RETRIES = 5;

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});


const retrieveTranslation = async (
  text: string,
  language: string
): Promise<any> => {
  let retry_count = 0;
  while (true) {
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        max_tokens: 2048,
        // frequency_penalty: 0,
        // presence_penalty: 0,
        // top_p: 1,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an experienced semantic translator. Follow the instructions carefully.",
          },
          {
            role: "user",
            content: `Translate this to ${language}. ONLY translate, NEVER provide explanations or insight on the translation itself, just strictly translate the text as clearly as you can, assuming the reader will have the context. The text to translate starts on the next line.\n\n${text}`,
          },
        ],
        stream: true,
      });

      return stream;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error(error);
        retry_count++;
        if (retry_count >= MAX_RETRIES) {
          console.error("... Max retries reached, aborting.");
          break;
        } else {
          console.error("... Retrying");
        }
      } else {
        console.error(error);
        console.error("... Not an API error, no retry.")
        break;
      }
    }
  }
};

export async function POST(request: Request) {
  try {
    const { content, language } = await request.json()
    const segments = content.split(/\r\n\r\n|\n\n/).map(parseSegment);
    const groups = groupSegmentsByTokenLength(segments, MAX_TOKENS_IN_SEGMENT);

    let index = 0;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (const group of groups) {
          const text = group.map((segment) => segment.text).join(" ");
          const response = await retrieveTranslation(text, language);
          const srtStream = parseStreamedResponse(response);
          const reader = srtStream.getReader();

          const g_lengths = group.map((segment) => segment.text.length);

          let decoded = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            decoded += decoder.decode(value);
          }

          const parts = [];
          if (/^\[\[ERROR:.*\]\]$/.test(decoded))
          {
            parts.push(...Array(group.length).fill(decoded));
          } else {
            const tokens: string[]= [];
            if (language === 'Japanese')
            {
              const jtokens = await tokenizeJapaneseText(decoded);
              tokens.push(...jtokens.map(jtoken => jtoken.surface_form));
            }
            else
            {
              const wtokens = decoded.match(/(\S+|\s+)/g) || [];
              tokens.push(...wtokens);
            }
            parts.push(...splitStringByRatios(tokens, g_lengths));
          }
          let partIndex = 0;

          for (const g of group) {
            const srt = [ g.id, g.timestamp, g.text + '\n' + parts[partIndex++] + '\n\n' ].join('\n');
            controller.enqueue(encoder.encode(srt));
          }
        }

        controller.close();
      }
    });

    return new Response(stream);
  } catch (error) {
    console.error("Error during translation:", error);
    return new Response(JSON.stringify({ error: "Error during translation" }), {
      status: 500,
    });
  }
}
