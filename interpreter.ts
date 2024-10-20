import { Decimal } from "decimal.js";
import type { Token } from "./lexer.ts";
import { errorAt } from "./misc.ts";

function writeStdout(str: string) {
    Deno.stdout.writeSync(Uint8Array.from(str.split("").map(a => a.charCodeAt(0))));
}

class Value {
    type: "number" | "string";
    value: Decimal | string;
    constructor (type: Value["type"], value: Value["value"]) {
        this.type = type;
        this.value = value;      
    }

    static newNumber(num: Decimal) {
        return new Value("number", num);
    }
    static newString(num: string) {
        return new Value("string", num);
    }

    equals(b: Value): boolean {
        return this.type == b.type ?
            this.type == "number" ?
                this.innerDecimal().eq(b.innerDecimal())
                : this.value == b.value
            : false
    }

    innerDecimal(): Decimal {
        if (this.type === "number") {
            return this.value as Decimal;
        }
        throw new Error("Value isn't number, couldn't extract inner Decimal")
    }
    innerString(): string {
        if (this.type === "string") {
            return this.value as string;
        }
        throw new Error("Value isn't string, couldn't extract inner string")
    }
}

export class Interpreter {
    source: string;
    tokens: Token[];
    ip: number;
    stack: Value[];
    functions: { [n: string]: (stack: Value[]) => void };
    constructor(source: string, tokens: Token[]) {
        this.ip = 0;
        this.source = source;
        this.tokens = tokens;
        this.stack = [];
        this.functions = {
            "+": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push(Value.newNumber(a.innerDecimal().add(b.innerDecimal()) ));
                } else if (b?.type == "string" && a?.type == "string") {
                    stack.push(Value.newString(a.innerString() + b.innerString()));
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
                    stack.push(Value.newNumber(a.innerDecimal().sub(b.value) ));
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
                    stack.push(Value.newNumber(a.innerDecimal().mul(b.value) ));
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
                    stack.push(Value.newNumber(a.innerDecimal().div(b.value) ));
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
                    stack.push(Value.newNumber(a.innerDecimal().pow(b.value) ));
                } else {
                    console.log(
                        "`^` can only be used with number + number, instead got",
                        `${b?.type} + ${a?.type}`,
                    );
                }
            },
            "sqrt": (stack) => {
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
            "pr": (stack) => {
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
            "prn": (stack) => {
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

                stack.push(Value.newNumber(new Decimal(+(a!.equals(b!))) ))
            },
            "!=": (stack) => {
                const a = stack.pop();
                const b = stack.pop();

                stack.push(Value.newNumber(new Decimal(-(a!.equals(b!))) ))
            },
            ">": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`>` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push(Value.newNumber(new Decimal(+a!.innerDecimal().gt(b!.innerDecimal()) )))
            },
            ">=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`>=` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push(Value.newNumber(new Decimal(+a!.innerDecimal().gte(b!.innerDecimal()) )))
            },
            "<": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`<` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push(Value.newNumber(new Decimal(+a!.innerDecimal().lt(b!.innerDecimal())) ))
            },
            "<=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`<=` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push(Value.newNumber(new Decimal(+a!.innerDecimal().lte(b!.innerDecimal())) ))
            },
            "lnot": (stack) => {
                const a = stack.pop();
                if (a?.type != "number") {
                    console.error("`lnot` takes only number, instead got", `${a?.type}`);
                    Deno.exit(1);
                }

                stack.push(Value.newNumber(new Decimal(+!a.innerDecimal().gte(1)) ))
            }
        };
    }

    interpret() {
        while (this.ip < this.tokens.length) {
            this.interpretOne();
            this.ip++;
        }
    }

    interpretOne() {
        const token = this.tokens[this.ip];
        switch (token.type) {
            case "numberLiteral":
                {
                    this.stack.push(Value.newNumber(new Decimal(token.value), ));
                }
                break;
            case "stringLiteral":
                {
                    this.stack.push(Value.newString(token.value));
                }
                break;
            case "keyword":
                {
                    switch (token.value) {
                        case "if":
                            {
                                const a = this.stack.pop();
                                if (a?.type == "number" && a.innerDecimal().gte(1)) {
                                    while (true) {
                                        if (this.tokens.length === 0) {
                                            errorAt(
                                                this.source,
                                                token,
                                                "No matching end block for if statement",
                                            );
                                        }
                                        this.ip++;
                                        if (
                                            this.tokens[this.ip].type == "keyword" &&
                                            this.tokens[this.ip].value == "end"
                                        ) {
                                            this.ip++;
                                            break;
                                        }
                                        this.interpretOne();
                                    }
                                } else {
                                    let depth = 0;
                                    while (true) {
                                        if (this.tokens.length === 0) {
                                            errorAt(
                                                this.source,
                                                token,
                                                "No matching end block for if statement",
                                            );
                                        }
                                        this.ip++;
                                        if (
                                            this.tokens[this.ip].type == "keyword" &&
                                            ["if", "while", "repeat", "foreach"].includes(this.tokens[this.ip].value)
                                        ) {
                                            depth++;
                                        }
                                        else if (
                                            this.tokens[this.ip].type == "keyword" &&
                                            this.tokens[this.ip].value == "end"
                                        ) {
                                            depth--;
                                            this.ip++;
                                            if (depth <= 0) {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        default: {
                            console.error(
                                "unimplemented: " + JSON.stringify(token),
                            );
                            Deno.exit(1);
                        }
                    }
                }
                break;
            case "identifier":
                {
                    const fn = this.functions[
                        token.value as keyof typeof this.functions
                    ];
                    fn(this.stack);
                }
                break;
        }
    }
}
