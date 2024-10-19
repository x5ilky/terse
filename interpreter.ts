import { Decimal } from "decimal.js";
import type { Token } from "./lexer.ts";
import { errorAt } from "./misc.ts";

function writeStdout(str: string) {
    Deno.stdout.writeSync(Uint8Array.from(str.split("").map(a => a.charCodeAt(0))));
}

type Value = ValueNumber | ValueString;

type ValueNumber = {
    type: "number";
    value: Decimal;
};
type ValueString = {
    type: "string";
    value: string;
};

function valueEquals(a: Value, b: Value): boolean {
    return a.type == b.type ?
        a.type == "number" ?
            a.value.eq(b.value as Decimal)
            : a.value == b.value
        : false
}

export class Interpreter {
    source: string;
    tokens: Token[];
    stack: Value[];
    functions: { [n: string]: (stack: Value[]) => void };
    constructor(source: string, tokens: Token[]) {
        this.source = source;
        this.tokens = tokens;
        this.stack = [];
        this.functions = {
            "+": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (b?.type == "number" && a?.type == "number") {
                    stack.push({ type: "number", value: a.value.add(b.value) });
                } else if (b?.type == "string" && a?.type == "string") {
                    stack.push({
                        type: "string",
                        value: a.value + b.value,
                    });
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
                    stack.push({ type: "number", value: a.value.sub(b.value) });
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
                    stack.push({ type: "number", value: a.value.mul(b.value) });
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
                    stack.push({ type: "number", value: a.value.div(b.value) });
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
                    stack.push({ type: "number", value: a.value.pow(b.value) });
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
                    stack.push({
                        type: "number",
                        value: a.value.sqrt(),
                    });
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
                        writeStdout(a?.value);
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

                stack.push({
                    type: "number",
                    value: new Decimal(+valueEquals(a!, b!))
                })
            },
            "!=": (stack) => {
                const a = stack.pop();
                const b = stack.pop();

                stack.push({
                    type: "number",
                    value: new Decimal(-valueEquals(a!, b!))
                })
            },
            ">": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`>` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push({
                    type: "number",
                    value: new Decimal(+a!.value.gt(b!.value))
                })
            },
            ">=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`>=` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push({
                    type: "number",
                    value: new Decimal(+a!.value.gte(b!.value))
                })
            },
            "<": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`<` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push({
                    type: "number",
                    value: new Decimal(+a!.value.lt(b!.value))
                })
            },
            "<=": (stack) => {
                const b = stack.pop();
                const a = stack.pop();
                if (a?.type != "number" || b?.type != "number") {
                    console.error("`<=` takes only number + number, instead got", `${a?.type}, ${b?.type}`);
                    Deno.exit(1);
                }

                stack.push({
                    type: "number",
                    value: new Decimal(+a!.value.lte(b!.value))
                })
            },
            "lnot": (stack) => {
                const a = stack.pop();
                if (a?.type != "number") {
                    console.error("`lnot` takes only number, instead got", `${a?.type}`);
                    Deno.exit(1);
                }

                stack.push({
                    type: "number",
                    value: new Decimal(+!a.value.gte(1))
                })
            }
        };
    }

    interpret() {
        while (this.tokens.length > 0) {
            this.interpretOne(this.tokens.shift()!);
        }
    }

    interpretOne(token: Token) {
        switch (token.type) {
            case "numberLiteral":
                {
                    this.stack.push({
                        type: "number",
                        value: new Decimal(token.value),
                    });
                }
                break;
            case "stringLiteral":
                {
                    this.stack.push({
                        type: "string",
                        value: token.value,
                    });
                }
                break;
            case "keyword":
                {
                    switch (token.value) {
                        case "if":
                            {
                                const a = this.stack.pop();
                                if (a?.type == "number" && a.value.gte(1)) {
                                    while (true) {
                                        if (this.tokens.length === 0) {
                                            errorAt(
                                                this.source,
                                                token,
                                                "No matching end block for if statement",
                                            );
                                        }
                                        if (
                                            this.tokens[0].type == "keyword" &&
                                            this.tokens[0].value == "end"
                                        ) {
                                            this.tokens.shift();
                                            break;
                                        }
                                        this.interpretOne(this.tokens.shift()!);
                                    }
                                } else {
                                    while (true) {
                                        if (this.tokens.length === 0) {
                                            errorAt(
                                                this.source,
                                                token,
                                                "No matching end block for if statement",
                                            );
                                        }
                                        if (
                                            this.tokens[0].type == "keyword" &&
                                            this.tokens[0].value == "end"
                                        ) {
                                            this.tokens.shift();
                                            break;
                                        }
                                        this.tokens.shift();
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
