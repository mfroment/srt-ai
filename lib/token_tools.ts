export const splitStringIntoParts = (
  tokens: string[],
  n: number
): string[] => {
  // Example usage
  // const tokens: string[] = ["This", " ", "is", " ", "a", " ", "sentence", ".", " ", "Here's", " ", "another", " ", "one", "."];
  // const n: number = 3; // Target number of parts
  // const parts: string[] = splitStringIntoParts(tokens, n);
  // console.log(parts);

  // Calculate the total length of tokens
  const totalLength: number = tokens.reduce((total, token) => total + token.length, 0);

  // Determine the approximate target length for each part
  const targetPartLength: number = totalLength / n;

  // Initialize variables to hold the current part's length and the parts array
  let currentPartLength: number = 0;
  let currentPart: string[] = [];
  let parts: string[][] = [currentPart];

  tokens.forEach(token => {
    // If adding this token to the current part would make its length exceed the target,
    // and we haven't already created all parts, start a new part
    if (currentPartLength + token.length > targetPartLength && parts.length < n) {
      currentPart = [];
      parts.push(currentPart);
      currentPartLength = 0;
    }

    // Add the token to the current part and update the current part's length
    currentPart.push(token);
    currentPartLength += token.length;
  });

  // Convert each part back into a string for output
  return parts.map(part => part.join(''));
}


export const splitStringByRatios = (
  tokens: string[],
  weights: number[]
): string[] => {
  // Example usage
  // const tokens = ["token1", "token2", "token3", "token4", "token5", "token6", "token7", "token8", "token9", "token10"];
  // const weights = [1, 2, 3];
  // const segments = splitStringByRatios(tokens, weights);
  // console.log(segments);

  const totalLength = tokens.reduce((acc, token) => acc + token.length, 0);
  const totalWeight = weights.reduce((acc, size) => acc + size, 0);
  let currentSegmentLength = 0;
  let segmentLengths = weights.map(size => Math.ceil((size / totalWeight) * totalLength));

  // The following is a sanity check that we will use all tokens thanks to using ceil above.
  // Indeed, if the first n-1 segments all fulfill the target length, then the last one at best
  // can fulfill it, or exhaust all remaining tokens trying; but it won't undershoot.
  const totalSegmentLength = segmentLengths.reduce((acc, segLength) => acc + segLength, 0);
  console.assert(totalSegmentLength >= totalLength);

  let segmentIndex = 0;
  const segments: string[][] = [];
  let currentSegment: string[] = [];

  // Initialize segments array
  for (let i = 0; i < weights.length; i++) {
    segments.push([]);
  }

  tokens.forEach((token, tokenIndex) => {
    currentSegmentLength += token.length;
    currentSegment.push(token);

    // Check if the current segment meets or exceeds its target length
    // or if we are running out of tokens for remaining segments (possibly 0 token and 0 segment remaining i.e. the end)
    if (currentSegmentLength >= segmentLengths[segmentIndex]
      || tokens.length - tokenIndex === segments.length - segmentIndex) {
        segments[segmentIndex] = currentSegment;
        segmentIndex++;
        currentSegment = [];
        currentSegmentLength = 0;
    }
  });

  // Convert segments of tokens into segments of strings
  const stringSegments = segments.map(segment => segment.join(""));

  return stringSegments;
}


import kuromoji, { IpadicFeatures } from 'kuromoji';

export const tokenizeJapaneseText = (
  text: string
): Promise<IpadicFeatures[]> => {
  // Example usage
  // const text = "これは日本語のテキストです。";
  // tokenizeJapaneseText(text).then(tokens => {
  //   console.log("Tokens:", tokens);
  // }).catch(err => {
  //   console.error("Error tokenizing Japanese text:", err);
  // });
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: "node_modules/kuromoji/dict/" }).build((err, tokenizer) => {
      if (err) {
        reject(err);
      } else {
        const tokens: IpadicFeatures[] = tokenizer.tokenize(text);
        resolve(tokens);
      }
    });
  });
}
