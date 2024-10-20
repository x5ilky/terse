import { Decimal } from "decimal.js";
import type { Location, Token } from "./lexer.ts";
import { errorAt } from "./misc.ts";

export type Instruction = InstructionBase & Location;
export type InstructionBase =
    | INumberLiteral
    | IStringLiteral
    | IIfStatement
    | IRepeatStatement
    | IWhileStatement
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
    endIp: number;
};
export type IRepeatStatement = {
    type: "IRepeatStatement";
    startIp: number;
    endIp: number;
};
export type IWhileStatement = {
    type: "IWhileStatement";
    startIp: number;
    endIp: number;
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
                    ...token,
                    type: "INumberLiteral",
                    value: new Decimal(token.value),

                });
                break;
            case "stringLiteral":
                instructions.push({
                    ...token,
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
                    ...token,
                                    type: "IIfStatement",
                                    endIp: -1,
                                });
                            }
                            break;
                        case "repeat":
                            {
                                endStack.push(instructions.length);
                                instructions.push({
                    ...token,
                                    type: "IRepeatStatement",
                                    startIp: instructions.length,
                                    endIp: -1,
                                });
                            }
                            break;
                        case "while":
                            {
                                endStack.push(instructions.length);
                                instructions.push({
                    ...token,
                                    type: "IWhileStatement",
                                    startIp: instructions.length,
                                    endIp: -1,
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
                                    case "IWhileStatement":
                                        {
                                            start.endIp = instructions.length;
                                            start.end = token.end;
                                        }
                                        break;
                                    default: {
                                        throw new Error("unreachable");
                                    }
                                }
                                instructions.push({
                    ...token,
                                    type: "INoop",
                                });
                            }
                            break;
                    }
                }
                break;
            case "identifier":
                instructions.push({ ...token, type: "ICall", instr: token.value });
                break;
        }
    }

    return instructions;
}
