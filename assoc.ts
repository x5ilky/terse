import * as path from "jsr:@std/path"
import { Decimal } from "decimal.js";
import { Lexer, type Location, type Token } from "./lexer.ts";
import { errorAt } from "./misc.ts";
import type { FileAssoc } from "./main.ts";

export type Instruction = InstructionBase & Location;
export type InstructionBase =
    | INumberLiteral
    | IStringLiteral
    | IIfStatement
    | IRepeatStatement
    | IWhileStatement
    | ILetBinding
    | IDropBinding
    | ICall
    | IFunctionStart
    | IVarDefine
    | IVarDrop
    | IReturn
    | IFunction
    | IImport
    | INoop;

export type INumberLiteral = {
    type: "INumberLiteral";
    value: Decimal;
};
export type IStringLiteral = {
    type: "IStringLiteral";
    value: string;
};
export type IImport = {
    type: "IImport";
    path: string;
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
    bodyIp: number;
    endIp: number;
    predicateIp: number;
};
export type ILetBinding = {
    type: "ILetBinding";
    names: string[];
};
export type IDropBinding = {
    type: "IDropBinding";
    names: string[];
};
export type INoop = {
    type: "INoop";
};
export type IFunctionStart = {
    type: "IFunctionStart";
};
export type IReturn = {
    type: "IReturn";
};
export type ICall = {
    type: "ICall";
    instr: string;
};
export type IVarDefine = {
    type: "IVarDefine";
    name: string;
    endIp: number;
};
export type IVarDrop = {
    type: "IVarDrop";
};
export type IFunction = {
    type: "IFunction";
    endIp: number;
    startIp: number;
    inputs: string[];
    output: string[];
    name: string;
};

export function associator(fileAssoc: FileAssoc, tokens: Token[]): Instruction[] {
    let instructions: Instruction[] = [];

    const endStack: number[] = [];
    let resolvedWhiles = 0;

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
                                    bodyIp: -1,
                                    predicateIp: instructions.length,
                                    endIp: -1,
                                });
                                resolvedWhiles++;
                            }
                            break;
                        case "do":
                            {
                                const whileIdx = endStack.pop();
                                endStack.push(whileIdx!);
                                if (whileIdx === undefined) {
                                    errorAt(fileAssoc[token.file], token, "random do keyword");
                                }
                                const whileBlock = instructions[whileIdx];
                                if (whileBlock.type !== "IWhileStatement") {
                                    errorAt(
                                        fileAssoc[token.file],
                                        token,
                                        "do keyword can only be used with `while`",
                                    );
                                }
                                whileBlock.bodyIp = instructions.length;
                                instructions.push({
                                    ...token,
                                    type: "INoop",
                                });
                                resolvedWhiles--;
                            }
                            break;
                        case "let":
                            {
                                const names = [];
                                do {
                                    const a = tokens[++i];
                                    if (
                                        a.type === "keyword" && a.value === "do"
                                    ) {
                                        break;
                                    }
                                    names.push(a.value);
                                } while (true);
                                endStack.push(instructions.length);
                                instructions.push({
                                    ...token,
                                    type: "ILetBinding",
                                    names,
                                });
                            }
                            break;
                        case "fn":
                            {
                                const name = tokens[++i];
                                if (name?.type !== "identifier") {
                                    errorAt(
                                        fileAssoc[token.file],
                                        token,
                                        "Either no name was received or name received wasnt an identifier",
                                    );
                                }
                                const inputs = [];
                                while (true) {
                                    if (i >= tokens.length) {
                                        errorAt(
                                            fileAssoc[token.file],
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
                                            fileAssoc[type.file],
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
                                            fileAssoc[token.file],
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
                                            fileAssoc[type.file],
                                            type,
                                            "Type of argument wasn't identifier",
                                        );
                                    }
                                    outputs.push(type.value);
                                }
                                endStack.push(instructions.length);
                                instructions.push({
                                    ...token,
                                    type: "IFunction",
                                    endIp: -1,
                                    startIp: instructions.length + 1,
                                    inputs,
                                    output: outputs,
                                    name: name.value,
                                });
                                instructions.push({
                                    ...token,
                                    type: "INoop",
                                });
                                instructions.push({
                                    ...token,
                                    type: "IFunctionStart",
                                });
                            }
                            break;
                        case "end":
                            {
                                if (endStack.length === 0) {
                                    errorAt(
                                        fileAssoc[token.file],
                                        token,
                                        "`end` keyword has no matching flow",
                                    );
                                }
                                const start = instructions[endStack.pop()!];
                                switch (start.type) {
                                    case "IIfStatement":
                                    case "IRepeatStatement":
                                    case "IWhileStatement":
                                    case "IVarDefine":
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
                                            instructions.push({
                                                ...token,
                                                type: "IVarDrop",
                                                
                                            });
                                        }
                                        break;
                                    case "ILetBinding":
                                        {
                                            instructions.push({
                                                ...token,
                                                type: "IDropBinding",
                                                names: start.names,
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
                        case "var": {
                            const name = tokens[++i];
                            endStack.push(instructions.length);
                            instructions.push({
                                ...token,
                                type: "IVarDefine",
                                name: name.value,
                                endIp: -1,
                            });
                        } break;
                        case "import": {
                            const pat = tokens[++i].value;
                            
                            if (pat.startsWith(".")) {
                                // relative path
                                errorAt(fileAssoc[token.file], token, "Relative imports haven't been implemented yet! Search for a todo called 'relative imports'");
                                // TODO: relative imports
                            }
                            const p = path.join(import.meta.dirname!, "std")
                            try {
                                const stdFolder = Deno.lstatSync(p);
                                if (!stdFolder.isDirectory) errorAt(fileAssoc[token.file], token, "std directory isn't a directory");
                                const file = path.join(p, pat);
                                const f = Deno.readTextFileSync(file);
                                fileAssoc[file] = f;
                                const lexer = new Lexer(f, file);
                                const tokens = lexer.lex();
                                let assoc = associator(fileAssoc, tokens);
                                assoc = assoc.map(a => {
                                    switch (a.type) {
                                        case "IIfStatement": a.endIp += instructions.length; break;
                                        case "IRepeatStatement": a.startIp += instructions.length; a.endIp += instructions.length; break;
                                        case "IWhileStatement": {
                                            a.bodyIp += instructions.length;
                                            a.endIp += instructions.length;
                                            a.predicateIp += instructions.length;
                                        } break;
                                        case "IFunction": {
                                            a.endIp += instructions.length;
                                            a.startIp += instructions.length;
                                        } break;
                                    }
                                    return a;
                                })
                                instructions = instructions.concat(assoc);
                            } catch (e) {
                                errorAt(fileAssoc[token.file], token, `Couldn't find standard library error: ${e}`)
                            }
                        } break;
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
                    fileAssoc[v.file],
                    v,
                    "error: if statement has no matching `end` keyword",
                );
                break;
            case "IRepeatStatement":
                errorAt(
                    fileAssoc[v.file],
                    v,
                    "error: repeat statement has no matching `end` keyword",
                );
                break;
            case "IWhileStatement":
                errorAt(
                    fileAssoc[v.file],
                    v,
                    "error: while statement has no matching `end` keyword",
                );
                break;
            case "IFunction":
                errorAt(
                    fileAssoc[v.file],
                    v,
                    "error: function has no matching `end` keyword",
                );
                break;
        }
    }

    if (resolvedWhiles) {
        for (const instr of instructions) {
            if (instr.type === "IWhileStatement" && instr.bodyIp === -1) {
                errorAt(fileAssoc[instr.file], instr, "while has no matching do keyword");
            }
        }
    }

    return instructions;
}
