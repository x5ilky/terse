import { Decimal } from "decimal.js";
import { errorAt } from "./misc.ts";
import type { Instruction } from "./assoc.ts";
import { Chainmap } from "./chainmap.ts";

function writeStdout(str: string) {
    Deno.stdout.writeSync(
        Uint8Array.from(str.split("").map((a) => a.charCodeAt(0))),
    );
}

class Value {
    type: "number" | "string";
    value: Decimal | string;
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
    static newString(num: string) {
        return new Value("string", num);
    }

    equals(b: Value): boolean {
        return this.type == b.type
            ? this.type == "number"
                ? this.innerDecimal().eq(b.innerDecimal())
                : this.value == b.value
            : false;
    }

    innerDecimal(): Decimal {
        if (this.type === "number") {
            return this.value as Decimal;
        }
        throw new Error("Value isn't number, couldn't extract inner Decimal");
    }
    innerString(): string {
        if (this.type === "string") {
            return this.value as string;
        }
        throw new Error("Value isn't string, couldn't extract inner string");
    }
}

export class Interpreter {
    source: string;
    instructions: Instruction[];
    ip: number;
    stack: Value[];
    callStack: number[];
    functions: {
        [n: string]: (stack: Value[], interpreter: Interpreter) => void;
    };
    bindings: Chainmap<string, Value>;
    constructor(source: string, instructions: Instruction[]) {
        this.ip = 0;
        this.source = source;
        this.instructions = instructions;
        this.stack = [];
        this.callStack = [];
        this.bindings = new Chainmap();
        this.functions = {
            "+": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(
                        Value.newNumber(a.innerDecimal().add(b.innerDecimal())),
                    );
                } else if (b?.type == "string" && a?.type == "string") {
                    stack.push(
                        Value.newString(a.innerString() + b.innerString()),
                    );
                } else {
                    console.log(
                        "`+` can only be used with number + number or string + string, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
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
            pr: (stack) => {
                const a = stack.pop();
                switch (a?.type) {
                    case "string":
                        writeStdout(a?.innerString());
                        break;
                    case "number":
                        writeStdout(a?.value.toString());
                        break;
                }
            },
            prn: (stack) => {
                const a = stack.pop();
                switch (a?.type) {
                    case "string":
                        console.log(a?.value);
                        break;
                    case "number":
                        console.log(a?.value.toString());
                        break;
                }
            },

            "==": (stack) => {
                const a = stack.pop();
                const b = stack.pop();

                stack.push(Value.newNumber(new Decimal(+a!.equals(b!))));
            },
            "!=": (stack) => {
                const a = stack.pop();
                const b = stack.pop();

                stack.push(Value.newNumber(new Decimal(-a!.equals(b!))));
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
        };
    }

    interpret() {
        while (this.ip < this.instructions.length) {
            this.interpretOne();
            this.ip++;
        }
    }

    interpretOne() {
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
                            if (this.ip === instr.endIp) {
                                break;
                            }
                            this.interpretOne();
                        }
                    } else {
                        this.ip = instr.end;
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
                            errorAt(
                                this.source,
                                instr,
                                `no function or binding called: ${instr.instr}`,
                            );
                        }
                        this.stack.push(this.bindings.get(instr.instr)!);
                    } else {
                        fn(this.stack, this);
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
            default:
                {
                    errorAt(
                        this.source,
                        instr,
                        // deno-lint-ignore no-explicit-any
                        `Unimplemented: ${(instr as any).type}`,
                    );
                }
                break;
        }
    }
}
