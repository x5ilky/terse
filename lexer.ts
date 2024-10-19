import { errorAt, validNumber } from "./misc.ts";

export type Token = Location & TokenBase;
export type TokenType = Token["type"];
export type Location = {
    file: string;
    start: number;
    end: number;
};

type TokenBase =
    | TokenNumberLiteral
    | TokenStringLiteral
    | TokenKeyword
    | TokenIdentifier;

type TokenNumberLiteral = {
    type: "numberLiteral";
    value: string;
};
type TokenStringLiteral = {
    type: "stringLiteral";
    value: string;
};
type TokenKeyword = {
    type: "keyword";
    value: string;
};
type TokenIdentifier = {
    type: "identifier";
    value: string;
};

export class Lexer {
    chars: (string | null)[];
    source: string;
    location: Location;

    constructor(source: string, filename: string) {
        this.source = source;
        this.chars = [...source.split(""), null];
        this.location = {
            file: filename,
            start: 0,
            end: 0,
        };
    }

    eat(): string {
        this.location.end++;
        return this.chars.shift()!;
    }
    peek(): string | null {
        return this.chars[0];
    }

    lex(): Token[] {
        // deno-lint-ignore prefer-const
        let tokens: Token[] = [];
        let buffer = "";
        while (this.peek() !== null) {
            const ch = this.eat();
            if (/\s/.test(ch)) {
                this.location.start++;
                this.location.end = this.location.start;
                continue;
            }
            if (ch == '"') {
                // string
                while (true) {
                    if (this.peek() == null) {
                        errorAt(
                            this.source,
                            this.location,
                            "expected end of string, instead got EOF",
                        );
                    }
                    const ch = this.eat();
                    if (ch == '"') {
                        break;
                    }
                    buffer += ch;
                }

                tokens.push({
                    ...this.location,
                    type: "stringLiteral",
                    value: buffer,
                });
                this.location.start = this.location.end;
                buffer = "";
            } else {
                buffer = ch;
                while (true) {
                    if (this.peek() === null || /\s/.test(this.peek()!)) {
                        break;
                    }

                    buffer += this.eat();
                }
                if (buffer.length === 0) continue;
                // buffer.chars().all(v => isNumeric(v))
                if (validNumber(buffer)) {
                    // number
                    tokens.push({
                        ...this.location,
                        type: "numberLiteral",
                        value: buffer,
                    });
                } else {
                    switch (buffer) {
                        case "if":
                        case "end":
                        case "repeat":
                        case "foreach":
                        case "while":
                            {
                                tokens.push({
                                    ...this.location,
                                    type: "keyword",
                                    value: buffer,
                                });
                            }
                            break;
                        default: {
                            tokens.push({
                                ...this.location,
                                type: "identifier",
                                value: buffer,
                            });
                        }
                    }
                }
                this.location.start = this.location.end;
                buffer = "";
            }
        }
        return tokens;
    }
}