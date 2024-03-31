import { Segment } from "@/types";
import { encoding_for_model } from "tiktoken";

/**
 * Groups segments into groups of length `length` or less.
 */
export function groupSegmentsByTokenLength(segments: Segment[], length: number) {
  const groups: Segment[][] = [];
  let currentGroup: Segment[] = [];
  let currentGroupTokenCount = 0;
  const encoder = encoding_for_model("gpt-4");

  function numTokens(text: string) {
    const tokens = encoder.encode(text);
    return tokens.length;
  }

  for (const segment of segments) {
    const segmentTokenCount = numTokens(segment.text);

    if (currentGroupTokenCount + segmentTokenCount <= length) {
      currentGroup.push(segment);
      currentGroupTokenCount += segmentTokenCount + 1; // include size of the "|" delimeter
      if (/([.?!]|[[.?!,][)}\]])$/.test(segment.text)) {
        groups.push(currentGroup);
        currentGroup = [];
        currentGroupTokenCount = 0;
      }
    } else {
      groups.push(currentGroup);
      currentGroup = [segment];
      currentGroupTokenCount = segmentTokenCount;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  encoder.free(); // clear encoder from memory
  return groups;
}

export function parseStreamedResponse(
  stream: any,
): ReadableStream {
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          let content = chunk.choices[0]?.delta?.content;
          buffer += content || "";
        }
      } catch (error) {
        console.error(error);
        buffer = "[[ERROR: Translation failed, edit manually]]";
      }

      controller.enqueue(encoder.encode(buffer));

      controller.close();
    },
  });
};
