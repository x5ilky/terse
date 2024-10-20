import { Decimal } from "decimal.js";
import type { Token } from "./lexer.ts";
import { errorAt } from "./misc.ts";

export type Instruction =
    | INumberLiteral
    | IStringLiteral
    | IIfStatement
    | IRepeatStatement
    | ICall
    | INoop;

export type INumberLiteral = {
    type: "INumberLiteral";
    value: Decimal;
};
export type IStringLiteral = {
    type: "IStringLiteral";
    value: string;
};
export type IIfStatement = {
    type: "IIfStatement";
    end: number;
};
export type IRepeatStatement = {
    type: "IRepeatStatement";
    start: number;
    end: number;
};
export type INoop = {
    type: "INoop";
};
export type ICall = {
    type: "ICall";
    instr: string;
};

export function associator(source: string, tokens: Token[]): Instruction[] {
    const instructions: Instruction[] = [];

    const endStack: number[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        switch (token.type) {
            case "numberLiteral":
                instructions.push({
                    type: "INumberLiteral",
                    value: new Decimal(token.value),
                });
                break;
            case "stringLiteral":
                instructions.push({
                    type: "IStringLiteral",
                    value: token.value,
                });
                break;
            case "keyword":
                {
                    switch (token.value) {
                        case "if":
                            {
                                endStack.push(instructions.length);
                                instructions.push({
                                    type: "IIfStatement",
                                    end: -1,
                                });
                            }
                            break;
                        case "repeat":
                            {
                                endStack.push(instructions.length);
                                instructions.push({
                                    type: "IRepeatStatement",
                                    start: instructions.length,
                                    end: -1,
                                });
                            }
                            break;
                        case "end":
                            {
                                if (endStack.length === 0) {
                                    errorAt(
                                        source,
                                        token,
                                        "`end` keyword has no matching flow",
                                    );
                                }
                                const start = instructions[endStack.pop()!];
                                switch (start.type) {
                                    case "IIfStatement":
                                    case "IRepeatStatement":
                                        {
                                            start.end = instructions.length;
                                        }
                                        break;
                                    default: {
                                        throw new Error("unreachable");
                                    }
                                }
                                instructions.push({
                                    type: "INoop",
                                });
                            }
                            break;
                    }
                }
                break;
            case "identifier":
                instructions.push({ type: "ICall", instr: token.value });
                break;
        }
    }

    return instructions;
}
