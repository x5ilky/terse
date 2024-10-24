import { Chainmap } from "./chainmap.ts";
import { errorAt } from "./misc.ts";
import { type Location } from "./lexer.ts";
import type { FileAssoc } from "./main.ts";
import type { Instruction } from "./assoc.ts";

class Type {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    valid(other: Type): boolean {
        if (this.name === "any") {
            return true;
        }
        if (other.name === "any") {
            return true;
        }
        return this.name === other.name;
    }
}

const TNumber = () => new Type("number");
const TString = () => new Type("string");
const TPointer = () => new Type("ptr");
const TAny = () => new Type("any");

export class Typechecker {
    fileAssoc: FileAssoc;
    stack: Type[];
    functions: { [n: string]: { inputs: Type[]; outputs: Type[] } };
    instructions: Instruction[];
    bindings: Chainmap<string, Type>;
    ip: number;

    constructor(fileAssoc: FileAssoc, instructions: Instruction[]) {
        this.fileAssoc = fileAssoc;
        this.instructions = instructions;
        this.bindings = new Chainmap();
        this.functions = {
            "???": { inputs: [], outputs: [] },
            "+": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "ptr+": {inputs: [TPointer(), TNumber()], outputs: [TPointer()]},
            "str+": {inputs: [TString(), TString()], outputs: [TString()]},
            "-": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "*": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "/": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "^": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "sqrt": { inputs: [TNumber()], outputs: [TNumber()] },
            "round": { inputs: [TNumber()], outputs: [TNumber()] },
            "ceil": { inputs: [TNumber()], outputs: [TNumber()] },
            "floor": { inputs: [TNumber()], outputs: [TNumber()] },
            "is-integer": { inputs: [TNumber()], outputs: [TNumber()] },
            "pr": { inputs: [TAny()], outputs: [] },
            "==": { inputs: [TAny(), TAny()], outputs: [TNumber()] },
            "!=": { inputs: [TAny(), TAny()], outputs: [TNumber()] },
            "&&": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "||": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            ">=": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "<=": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            ">": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "<": { inputs: [TNumber(), TNumber()], outputs: [TNumber()] },
            "dup": { inputs: [TAny()], outputs: [TAny(), TAny()] },
            "drop": { inputs: [TAny()], outputs: [] },
            "swap": { inputs: [TAny(), TAny()], outputs: [TAny(), TAny()] },

            "ips": { inputs: [TString()], outputs: [TString() ]},

            "str2num": {inputs: [TString()], outputs: [TNumber()]},
            "num2str": {inputs: [TNumber()], outputs: [TString()]},
            "str2countstr": {inputs: [TString()], outputs: [TPointer(), TNumber()]},

            "memalloc": {inputs: [TNumber()], outputs: [TPointer()]},
            "memfree": {inputs: [TPointer()], outputs: []},
            "memsave": {inputs: [TAny(), TPointer()], outputs: []},
            "memload": {inputs: [TPointer()], outputs: [TAny()]},
        };
        this.stack = [];
        this.ip = 0;
    }

    getFileSource(instr: Location): string {
        return this.fileAssoc[instr.file];
    }

    merge(other: Typechecker) {
        for (const fn in other.functions) {
            this.functions[fn] = other.functions[fn];
        }
    }

    typecheck() {
        while (this.ip < this.instructions.length) {
            this.typecheckOne();
            this.ip++;
        }
        if (this.stack.length) {
            console.error(`error: ${this.stack.length} elements left on stack at end of program`);
            Deno.exit(1);
        }
    }

    typecheckOne() {
        const instr = this.instructions[this.ip];
        switch (instr.type) {
            case "INumberLiteral":
                this.stack.push(TNumber());
                break;
            case "IStringLiteral":
                this.stack.push(TString());
                break;
            case "IIfStatement":
                {
                    if (this.stack.length === 0) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            "No elements on stack, if statement has no condition",
                        );
                    }
                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `If statement only works on type number, instead got type '${popped}'`,
                        );
                    }
                    const beginSize = this.stack.length;

                    if (instr.elseIp === -1) {
                        while (this.ip < instr.endIp) {
                            this.ip++;
                            this.typecheckOne();
                        }
                        if (this.stack.length !== beginSize) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `Stack size inside and outside of if statement are different; got ${
                                    this.stack.length - beginSize
                                } more element(s) in if branch`,
                            );
                        }
                    } else {
                        const stack = this.stack.map(a => new Type(a.name));
                        while (this.ip < instr.elseIp) {
                            this.ip++;
                            this.typecheckOne();
                        }
                        const mainStack = this.stack.length;
                        this.stack = stack;
                        this.ip = instr.elseIp;
                        while (this.ip < instr.endIp) {
                            this.ip++;
                            this.typecheckOne();
                        }

                        if (mainStack !== this.stack.length) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `Stack size in different branchs of if statement are different; got ${
                                    mainStack - this.stack.length
                                } more element(s) in if branch compared to else branch`,
                            );
                        }
                    }
                }
                break;
            case "IRepeatStatement":
                {
                    if (this.stack.length === 0) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            "No elements on stack, repeat statement has no iterator",
                        );
                    }
                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `'repeat' statement only works on type number, instead got type '${popped}'`,
                        );
                    }
                }
                break;
            case "IWhileStatement":
                {
                    const startingSize = this.stack.length;
                    // run predicate
                    while (this.ip < instr.bodyIp) {
                        this.ip++;
                        this.typecheckOne();
                    }

                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `'while' statement predicate only works on type number, instead got type '${popped}'`,
                        );
                    }
                    if (this.stack.length !== startingSize) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `While statement predicate should give 1 more element (predicate); instead got ${
                                this.stack.length - startingSize
                            } more element(s) after while statement`,
                        );
                    }
                }
                break;
            case "ILetBinding":
                {
                    this.bindings.push();
                    if (instr.names.length > this.stack.length) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `binding requires ${instr.names.length} values to be on stack, only received ${this.stack.length}`,
                        );
                    }
                    for (const binding of instr.names.toReversed()) {
                        this.bindings.set(binding, this.stack.pop()!);
                    }
                }
                break;
            case "ICall":
                {
                    if (instr.instr === "dup") {
                        if (this.stack.length === 0) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `Not enough elements on stack for dup`
                            );
                        }
                        const p = this.stack.pop()!;
                        this.stack.push(p, p);
                        return;
                    }
                    if (instr.instr === "swap") {
                        if (this.stack.length < 2) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `Not enough elements on stack for swap`
                            );
                        }
                        const a = this.stack.pop()!;
                        const b = this.stack.pop()!;
                        this.stack.push(a);
                        this.stack.push(b);
                        return;
                    }
                    const fn = this.functions[instr.instr];
                    if (fn === undefined) {
                        const binding = this.bindings.get(instr.instr);
                        if (binding === undefined) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `no function or binding called ${instr.instr}`,
                            );
                        }
                        this.stack.push(this.bindings.get(instr.instr)!);
                        return;
                    }
                    if (fn.inputs.length > this.stack.length) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `not enough elements on stack to call ${instr.instr}; ${instr.instr} takes ${fn.inputs.length} arguments, instead received ${this.stack.length} arguments.\nExpected: ${
                                fn.inputs.map(a => a.name).join(", ")
                            }; Received: ${this.stack.map(a => a.name).toReversed().join(", ")}`,
                        );
                    }
                    for (let i = 0; i < fn.inputs.length; i++) {
                        if (!fn.inputs[i].valid(this.stack[
                            this.stack.length - fn.inputs.length + i
                        ])) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `mismatching argument types; expected: ${
                                    fn.inputs.map((a) => a.name).join(", ")
                                }; received: ${
                                    this.stack.slice(-fn.inputs.length).map(
                                        (a) => a.name,
                                    ).join(", ")
                                }`,
                            );
                        }
                    }
                    for (let i = 0; i < fn.inputs.length; i++) {
                        this.stack.pop();
                    }
                    for (let i = 0; i < fn.outputs.length; i++) {
                        this.stack.push(fn.outputs[i]);
                    }
                }
                break;
            case "IFunction":
                {
                    const fn = {
                        inputs: instr.inputs.map((a) => new Type(a)),
                        outputs: instr.output.map((a) => new Type(a)),
                    };
                    this.functions[instr.name] = fn;
                    const before = this.stack.map((a) => new Type(a.name));
                    this.stack = fn.inputs.map((a) => new Type(a.name));
                    this.ip = instr.startIp;
                    while (this.ip < instr.endIp) {
                        this.typecheckOne();
                        this.ip++;
                    }
                    if (fn.outputs.length !== this.stack.length) {
                        errorAt(
                            this.getFileSource(instr),
                            instr,
                            `Expected function to leave ${fn.outputs.length} on stack. Expected: ${
                                fn.outputs.map((a) => a.name).join(", ")
                            }; Received: ${
                                this.stack.map((a) => a.name).join(", ")
                            }`,
                        );
                    }
                    for (let i = 0; i < fn.outputs.length; i++) {
                        if (!fn.outputs[i].valid(this.stack[i])) {
                            errorAt(
                                this.getFileSource(instr),
                                instr,
                                `Expected function to leave ${fn.outputs.length} on stack. Expected: ${
                                    fn.outputs.map((a) => a.name).join(", ")
                                }; Received: ${
                                    this.stack.map((a) => a.name).join(", ")
                                }`,
                            );
                        }
                    }
                    this.stack = before;
                }
                break;
            case "IDropBinding":
                this.bindings.pop();
                break;
            case "IImport":
            case "IReturn":
            case "INoop":
                break;
        }
    }
}
