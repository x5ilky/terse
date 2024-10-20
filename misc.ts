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
    let endCh: number = -1;

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
            endCh = col;
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
                out += ".";
            } else {
                out += char;
            }
        }
    }
    console.log(`error: ${error}`);
    console.log(`at: ${loc.file}:${startLine + 1}:${startCh}`);
    console.log(out.split("\n").map((v) => `| ${v}`).join("\n"));

    Deno.exit(1);
}
