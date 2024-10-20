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
    | IReturn
    | IFunction
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
export type IReturn = {
    type: "IReturn";
};
export type ICall = {
    type: "ICall";
    instr: string;
};
export type IFunction = {
    type: "IFunction";
    endIp: number;
    startIp: number;
    inputs: string[];
    output: string[];
    name: string;
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
                        case "fn":
                            {
                                const name = tokens[++i];
                                if (name?.type !== "identifier") {
                                    errorAt(
                                        source,
                                        token,
                                        "Either no name was received or name received wasnt an identifier",
                                    );
                                }
                                const inputs = [];
                                while (true) {
                                    if (i >= tokens.length) {
                                        errorAt(
                                            source,
                                            token,
                                            "Expected type of argument",
                                        );
                                    }

                                    const type = tokens[++i];
                                    if (
                                        type.type == "keyword" &&
                                        type.value == ":"
                                    ) {
                                        break;
                                    }

                                    if (type.type !== "identifier") {
                                        errorAt(
                                            source,
                                            type,
                                            "Type of argument wasn't identifier",
                                        );
                                    }
                                    inputs.push(type.value);
                                }
                                const outputs = [];
                                while (true) {
                                    if (i >= tokens.length) {
                                        errorAt(
                                            source,
                                            token,
                                            "Expected type of output",
                                        );
                                    }

                                    const type = tokens[++i];
                                    if (
                                        type.type == "keyword" &&
                                        type.value == "do"
                                    ) {
                                        break;
                                    }

                                    if (type.type !== "identifier") {
                                        errorAt(
                                            source,
                                            type,
                                            "Type of argument wasn't identifier",
                                        );
                                    }
                                    outputs.push(type.value);
                                }
                                const start = instructions.length;
                                instructions.push({
                                    ...token,
                                    type: "IFunction",
                                    endIp: -1,
                                    startIp: start,
                                    inputs,
                                    output: outputs,
                                    name: name.value,
                                });
                                endStack.push(start);
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
                                    case "IFunction":
                                        {
                                            start.end = token.end;
                                            start.endIp = instructions.length;
                                            instructions.push({
                                                ...token,
                                                type: "IReturn",
                                            });
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
                instructions.push({
                    ...token,
                    type: "ICall",
                    instr: token.value,
                });
                break;
        }
    }

    while (endStack.length) {
        const a = endStack.pop()!;
        const v = instructions[a];
        switch (v.type) {
            case "IIfStatement":
                errorAt(
                    source,
                    v,
                    "error: if statement has no matching `end` keyword",
                );
                break;
            case "IRepeatStatement":
                errorAt(
                    source,
                    v,
                    "error: repeat statement has no matching `end` keyword",
                );
                break;
            case "IWhileStatement":
                errorAt(
                    source,
                    v,
                    "error: while statement has no matching `end` keyword",
                );
                break;
            case "IFunction":
                errorAt(
                    source,
                    v,
                    "error: function has no matching `end` keyword",
                );
                break;
        }
    }

    return instructions;
}
