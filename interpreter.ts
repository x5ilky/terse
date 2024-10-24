import * as path from "jsr:@std/path"
import { Decimal } from "decimal.js";
import { asyncPrompt, errorAt, writeStdout } from "./misc.ts";
import { associator, type Instruction } from "./assoc.ts";
import { Chainmap } from "./chainmap.ts";
import { Lexer, type Location } from "./lexer.ts";
import type { FileAssoc } from "./main.ts";


class Value {
    type: "number" | "string" | "ptr";
    value: Decimal | string | number;
    constructor(type: Value["type"], value: Value["value"]) {
        this.type = type;
        this.value = value;
    }

    clone() {
        return new Value(this.type, this.value);
    }

    static newNumber(num: Decimal) {
        return new Value("number", num);
    }
    static newPointer(num: number) {
        return new Value("ptr", num);
    }
    static newString(num: string) {
        return new Value("string", num);
    }

    equals(b: Value): boolean {
        if (this.type !== b.type) return false;
        switch (this.type) {
            case "string": return b.type === "string" ? this.value === b.value : false;
            case "number": return b.type === "number" ? this.innerDecimal().eq(b.innerDecimal()) : false;
            case "ptr":  return b.type === "ptr" ? this.innerPointer() === b.innerPointer() : false;
        }
    }

    innerDecimal(): Decimal {
        if (this.type === "number") {
            return this.value as Decimal;
        }
        throw new Error("Value isn't number, couldn't extract inner Decimal");
    }
    innerPointer(): number {
        if (this.type === "ptr") {
            return this.value as number;
        }
        throw new Error("Value isn't number, couldn't extract inner Decimal");
    }
    innerString(): string {
        if (this.type === "string") {
            return this.value as string;
        }
        throw new Error("Value isn't string, couldn't extract inner string");
    }

    toRepresentable(): string {
        switch (this.type) {
            case "string":
                return this.innerString();
            case "number":
                return this.innerDecimal().toString();
            case "ptr":
                return `<ptr: ${this.value as number}>`;
        }
    }
}

export class Interpreter {
    fileAssoc: FileAssoc;
    instructions: Instruction[];
    memory: Value[];
    memoryMap: {start: number, size: number, free: boolean}[]
    ip: number;
    stack: Value[];
    callStack: number[];
    functions: {
        [n: string]: (stack: Value[], interpreter: Interpreter) => Promise<void> | void;
    };
    bindings: Chainmap<string, Value>;
    constructor(fileAssoc: FileAssoc, instructions: Instruction[]) {
        this.ip = 0;
        this.fileAssoc = fileAssoc;
        this.instructions = instructions;
        this.stack = [];
        this.callStack = [];
        this.memory = [];
        this.memoryMap = [
            {free: true, size: 300000, start: 0}
        ];
        this.bindings = new Chainmap();
        this.functions = {
            "???": stack => {
                console.dir(stack.map(a => a.type), {depth: null});
                Deno.exit(1);
            },
            "+": (stack) => {
                const b = stack.pop()!;
                const a = stack.pop()!;
                    stack.push(
                        Value.newNumber(a.innerDecimal().add(b.innerDecimal())),
                    );
            },
            "ptr+": (stack) => {
                const b = stack.pop()!.innerDecimal();
                const a = stack.pop()!.innerPointer();
                stack.push(
                    Value.newPointer(Math.round(a + b.toNumber())),
                );
            },
            "str+": stack => {
                const b = stack.pop()!;
                const a = stack.pop()!;
                stack.push(
                    Value.newString(a.innerString() + b.innerString()),
                );
            },
            "-": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().sub(b.value)));
                } else {
                    console.log(
                        "`-` can only be used with number + number, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
            },
            "*": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().mul(b.value)));
                } else {
                    console.log(
                        "`*` can only be used with number + number, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
            },
            "/": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().div(b.value)));
                } else {
                    console.log(
                        "`/` can only be used with number + number, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
            },
            "^": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().pow(b.value)));
                } else {
                    console.log(
                        "`^` can only be used with number + number, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
            },
            sqrt: (stack) => {
                const a = stack.pop();
                if (a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().sqrt()));
                } else {
                    console.log(
                        "`sqrt` can only be used with number, instead got",
                        `${a?.type}`,
                    );
                }
            },
            floor: (stack) => {
                const a = stack.pop()!;
                stack.push(Value.newNumber(a.innerDecimal().floor()))
            },
            ceil: (stack) => {
                const a = stack.pop()!;
                stack.push(Value.newNumber(a.innerDecimal().ceil()))
            },
            round: (stack) => {
                const a = stack.pop()!;
                stack.push(Value.newNumber(a.innerDecimal().round()))
            },
            "is-integer": (stack) => {
                const a = stack.pop()!;
                stack.push(Value.newNumber(new Decimal(+a.innerDecimal().isInteger())))
            },
            pr: (stack) => {
                const a = stack.pop();
                switch (a?.type) {
                    case "string":
                        writeStdout(a?.innerString());
                        break;
                    case "number":
                        writeStdout(a?.innerDecimal().toString());
                        break;
                    case "ptr":
                        writeStdout((a.value as number).toString());
                        break;
                }
            },

            "&&": (stack) => {
                const a = stack.pop()?.innerDecimal()!;
                const b = stack.pop()?.innerDecimal()!;

                stack.push(Value.newNumber(new Decimal(+(a.gt(0) && b.gt(0)))));
            },
            "||": (stack) => {
                const a = stack.pop()?.innerDecimal()!;
                const b = stack.pop()?.innerDecimal()!;

                stack.push(Value.newNumber(new Decimal(+(a.gt(0) || b.gt(0)))));
            },
            "==": (stack) => {
                const a = stack.pop();
                const b = stack.pop();
                stack.push(Value.newNumber(new Decimal(+a!.equals(b!))));
            },
            "!=": (stack) => {
                const a = stack.pop();
                const b = stack.pop();

                stack.push(Value.newNumber(new Decimal(+!a!.equals(b!))));
            },
            ">": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error(
                        "`>` takes only number + number, instead got",
                        `${a?.type}, ${b?.type}`,
                    );
                    Deno.exit(1);
                }

                stack.push(
                    Value.newNumber(
                        new Decimal(+a!.innerDecimal().gt(b!.innerDecimal())),
                    ),
                );
            },
            ">=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error(
                        "`>=` takes only number + number, instead got",
                        `${a?.type}, ${b?.type}`,
                    );
                    Deno.exit(1);
                }

                stack.push(
                    Value.newNumber(
                        new Decimal(+a!.innerDecimal().gte(b!.innerDecimal())),
                    ),
                );
            },
            "<": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error(
                        "`<` takes only number + number, instead got",
                        `${a?.type}, ${b?.type}`,
                    );
                    Deno.exit(1);
                }

                stack.push(
                    Value.newNumber(
                        new Decimal(+a!.innerDecimal().lt(b!.innerDecimal())),
                    ),
                );
            },
            "<=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error(
                        "`<=` takes only number + number, instead got",
                        `${a?.type}, ${b?.type}`,
                    );
                    Deno.exit(1);
                }

                stack.push(
                    Value.newNumber(
                        new Decimal(+a!.innerDecimal().lte(b!.innerDecimal())),
                    ),
                );
            },
            lnot: (stack) => {
                const a = stack.pop();
                if (a?.type != "number") {
                    console.error(
                        "`lnot` takes only number, instead got",
                        `${a?.type}`,
                    );
                    Deno.exit(1);
                }

                stack.push(
                    Value.newNumber(new Decimal(+!a.innerDecimal().gte(1))),
                );
            },

            dup: (stack) => {
                const a = stack.pop()!;

                stack.push(a, a.clone());
            },
            swap: (stack) => {
                const a = stack.pop()!;
                const b = stack.pop()!;

                stack.push(a);
                stack.push(b);
            },
            drop: (stack) => {
                stack.pop()!;
            },

            ipn: async (stack) => {
                const value = new Decimal(
                    (await asyncPrompt(stack.pop()?.toRepresentable()) ?? "0").trim(),
                );
                stack.push(Value.newNumber(value));
            },
            ips: async (stack) => {
                const value = 
                    await asyncPrompt(stack.pop()?.toRepresentable()) ?? "";
                stack.push(Value.newString(value));
            },
            
            str2num: stack => {
                const str = stack.pop()!;
                stack.push(Value.newNumber(new Decimal(str.innerString().trim())))
            },
            num2str: stack => {
                const num = stack.pop()!;
                stack.push(Value.newString(num.innerDecimal().toString()))
            },

            memalloc: (stack, int) => {
                const size = stack.pop()!;
                stack.push(Value.newPointer(int.memoryAlloc(Math.floor(size.innerDecimal().toNumber()))))
            },
            memfree: (stack, int) => {
                const ptr = stack.pop()!;
                int.memoryFree(Math.floor(ptr.value as number))
            },
            memsave: (stack, int) => {
                const ptr = stack.pop()!;
                const value = stack.pop()!;
                int.memory[Math.floor(ptr.value as number)] = value;
            },
            memload: (stack, int) => {
                const ptr = stack.pop()!;
                const v = int.memory[ptr.value as number];
                stack.push(
                    v
                );
            },

            str2countstr: (stack, int) => {
                const str = stack.pop()!.innerString();
                const alloc = int.memoryAlloc(str.length);
                for (let i = 0; i < str.length; i++) int.memory[i + alloc] = Value.newString(str[i]);
                stack.push(Value.newPointer(alloc));
                stack.push(Value.newNumber(new Decimal(str.length)));
            }
        };
    }

    merge(other: Interpreter) {
        for (const fn in other.functions) {
            this.functions[fn] = other.functions[fn]
        }
    }

    getFileSource(instr: Location): string {
        return this.fileAssoc[instr.file]
    }

    async interpret() {
        this.bindings.push();
        while (this.ip < this.instructions.length) {
            await this.interpretOne();
            this.ip++;
        }
        this.bindings.pop();
        
        if (this.memoryMap.length > 1) {
            console.error("Unfreed memory in program, please check you have memfree'd all memalloc's")
        }
    }

    async interpretOne() {
        const instr = this.instructions[this.ip];
        switch (instr.type) {
            case "INumberLiteral":
                {
                    this.stack.push(Value.newNumber(instr.value));
                }
                break;
            case "IStringLiteral":
                {
                    this.stack.push(Value.newString(instr.value));
                }
                break;
            case "IIfStatement":
                {
                    const a = this.stack.pop();
                    if (a?.type == "number" && a.innerDecimal().gte(1)) {
                        while (true) {
                            this.ip++;
                            if (this.ip >= (instr.elseIp === -1 ? instr.endIp : instr.elseIp)) {
                                break;
                            }
                            this.interpretOne();
                        }
                        this.ip = instr.endIp;
                    } else {
                        if (instr.elseIp !== -1)
                        this.ip = instr.elseIp;
                        else this.ip = instr.endIp;
                    }
                }
                break;
            case "IRepeatStatement":
                {
                    const a = this.stack.pop();

                    for (
                        let i = new Decimal(0);
                        i.lt(a!.innerDecimal());
                        i = i.add(1)
                    ) {
                        this.ip = instr.startIp;
                        while (true) {
                            this.ip++;
                            if (this.ip === instr.endIp) {
                                break;
                            }
                            this.interpretOne();
                        }
                    }
                    this.ip = instr.endIp;
                }
                break;
            case "IWhileStatement":
                {
                    do {
                        this.ip = instr.predicateIp;
                        while (this.ip < instr.bodyIp) {
                            this.ip++;
                            // console.log(this.ip, instr.bodyIp, this.instructions[this.ip])
                            this.interpretOne();
                        }
                        const predicate = this.stack.pop()!;
                        if (predicate.innerDecimal().eq(0)) {
                            break;
                        }
                        this.ip = instr.bodyIp;
                        while (this.ip < instr.endIp) {
                            this.interpretOne();
                            this.ip++;
                        }
                    } while (true);
                    this.ip = instr.endIp;
                }
                break;
            case "IReturn":
                {
                    this.ip = this.callStack.pop()!;
                }
                break;
            case "ICall":
                {
                    const fn = this.functions[
                        instr.instr as keyof typeof this.functions
                    ];
                    if (fn === undefined) {
                        const binding = this.bindings.get(instr.instr);
                        if (binding === undefined) {
                            console.log(this.bindings);
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `no function or binding called: ${instr.instr}`,
                            );
                        }
                        this.stack.push(this.bindings.get(instr.instr)!);
                    } else {
                        await fn(this.stack, this);
                    }
                }
                break;
            case "IFunction":
                {
                    this.functions[instr.name] = (_stack, int) => {
                        int.callStack.push(this.ip);
                        int.ip = instr.startIp;
                    };
                    this.ip = instr.endIp;
                }
                break;

            case "ILetBinding":
                {
                    this.bindings.push();
                    for (const binding of instr.names.toReversed()) {
                        this.bindings.set(binding, this.stack.pop()!);
                    }
                }
                break;
            case "IDropBinding":
                {
                    this.bindings.pop();
                }
                break;
            case "INoop":
                break;
            case "IImport": {
                if (instr.path.startsWith(".")) {
                    // relative path
                    errorAt(this.getFileSource(instr), instr, "Relative imports haven't been implemented yet! Search for a todo called 'relative imports'");
                    // TODO: relative imports
                }
                const p = path.join(import.meta.dirname!, "std")
                try {
                    const stdFolder = Deno.lstatSync(p);
                    if (!stdFolder.isDirectory) errorAt(this.getFileSource(instr), instr, "std directory isn't a directory");
                    const file = path.join(p, instr.path);
                    const f = Deno.readTextFileSync(file);
                    const lexer = new Lexer(f, file);
                    const tokens = lexer.lex();
                    const assoc = associator(this.fileAssoc, tokens);
                    const inter = new Interpreter(this.fileAssoc, assoc);
                    inter.interpret();
                    this.merge(inter);
                } catch (e) {
                    errorAt(this.getFileSource(instr), instr, `Couldn't find standard library error: ${e}`)
                }
            } break;
            default:
                {
                    errorAt(
                        this.getFileSource(instr),
                        instr,
                        // deno-lint-ignore no-explicit-any
                        `Unimplemented: ${(instr as any).type}`,
                    );
                }
                break;
        }
    }
    
    memoryAlloc(size: number): number {
        for (let i = 0; i < this.memoryMap.length; i++) {
            const part = this.memoryMap[i];
            if (!part.free) continue;
            if (part.size >= size) {
                this.memoryMap.splice(i, 2, {free: false, size, start: part.start}, {free: true, size: part.size - size, start: part.start + size});
                this.memoryCondense();
                return part.start;
            }
        }
        throw new Error("Ran out of memory")
    }

    memoryFree(ptr: number) {
        const map = this.memoryMap.find(a => a.start === ptr)!;
        this.memoryMap.splice(
            this.memoryMap.findIndex(a => a.start === ptr)!,
            1,
            {
                free: true,
                size: map.size,
                start: map.start
            }
        );
        this.memoryCondense();
    }

    memoryCondense() {
        for (let i = 0; i < this.memoryMap.length; i++) {
            const part = this.memoryMap[i];
            if (part.free) {
                if (this.memoryMap?.[i+1] === undefined) continue;
                if (this.memoryMap[i+1].free) {
                    this.memoryMap.splice(i, 2, {
                        start: part.start,
                        size: part.size + this.memoryMap[i+1].size,
                        free: true
                    });
                    this.memoryCondense();
                }
            }
        }
    }
}
