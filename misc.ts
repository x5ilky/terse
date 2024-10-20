import type { Location } from "./lexer.ts";

export function isAlpha(char: string) {
    const code = char.charCodeAt(0);
    return (
        code >= 65 && code <= 90 ||
        code >= 97 && code <= 122
    );
}
export function isNumeric(char: string) {
    const code = char.charCodeAt(0);
    return (
        code >= 48 && code <= 57
    );
}
export function isAlphaNumeric(char: string) {
    return isAlpha(char) || isNumeric(char);
}

export function validNumber(str: string) {
    return /^[0-9]+(\.[0-9]+)?$/.test(str);
}

export function errorAt(source: string, loc: Location, error: string): never {
    let startLine: number = -1;
    let endLine: number = -1;
    let startCh: number = -1;

    let line = 0;
    let col = 0;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === "\n") {
            line++;
            col = 0;
        } else {
            col++;
        }
        if (i == loc.start) {
            startLine = line;
            startCh = col;
        }
        if (i == loc.end - 1) {
            endLine = line;
        }
    }

    let out = "";
    line = 0;
    col = 0;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === "\n") {
            line++;
            col = 0;
        }
        if (startLine <= line && line <= endLine) {
            if (i < loc.start || i >= loc.end) {
                out += `\x1b[90m${char}\x1b[0m`;
            } else {
                out += `\x1b[33m${char}\x1b[0m`;
            }
        }
    }
    console.log(`\x1b[31merror: \x1b[0m${error}`);
    console.log(`at: ${loc.file}:${startLine + 1}:${startCh}`);
    console.log(out.split("\n").map((v) => `| ${v}`).join("\n"));

    Deno.exit(1);
}

export function writeStdout(str: string) {
    Deno.stdout.writeSync(
        Uint8Array.from(str.split("").map((a) => a.charCodeAt(0))),
    );
}

export async function asyncPrompt(str?: string) {
  if (str) writeStdout(str);
  const buf = new Uint8Array(1024);
  /* Reading into `buf` from start.
   * buf.subarray(0, n) is the read result.
   * If n is instead Deno.EOF, then it means that stdin is closed.
   */
  const n = await Deno.stdin.read(buf); 
  if (n == null) {
    return undefined
  } else {
    return new TextDecoder().decode(buf.subarray(0, n));
  }
}