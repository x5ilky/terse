import type { Instruction } from "./assoc.ts";
import { Chainmap } from "./chainmap.ts";
import { errorAt } from "./misc.ts";

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
        return this.name === other.name
    }
}

const TNumber = () => new Type("number");
const TString = () => new Type("string");
const TAny = () => new Type("any");

export class Typechecker {
    source: string;
    stack: Type[];
    functions: {[n: string]: {inputs: Type[], outputs: Type[]}}
    instructions: Instruction[];
    bindings: Chainmap<string, Type>;
    ip: number;

    constructor(source: string, instructions: Instruction[]) {
        this.source = source;
        this.instructions = instructions;
        this.bindings = new Chainmap();
        this.functions = {
            "+": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "-": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "*": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "/": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "^": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "sqrt": {inputs: [TNumber()], outputs: [TNumber()]},
            "pr": {inputs: [TAny()], outputs: []},
            "prn": {inputs: [TAny()], outputs: []},
            "==": {inputs: [TAny(), TAny()], outputs: [TNumber()]},
            "!=": {inputs: [TAny(), TAny()], outputs: [TNumber()]},
            ">=": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "<=": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            ">": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "<": {inputs: [TNumber(), TNumber()], outputs: [TNumber()]},
            "dup": {inputs: [TAny()], outputs: [TAny(), TAny()]},
            "drop": {inputs: [TAny()], outputs: [TAny()]},
            "swap": {inputs: [TAny(), TAny()], outputs: [TAny(), TAny()]},
        };
        this.stack = [];
        this.ip = 0;
    }

    typecheck() {
        while (this.ip < this.instructions.length) {
            this.typecheckOne();
            this.ip++;
        }
    }

    typecheckOne() {
            const instr = this.instructions[this.ip];
            switch (instr.type) {
                case "INumberLiteral": this.stack.push(TNumber()); break;
                case "IStringLiteral": this.stack.push(TString()); break;
                case "IIfStatement": {
                    if (this.stack.length === 0) {
                        errorAt(this.source, instr, "No elements on stack, if statement has no condition");
                    }
                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(this.source, instr, `If statement only works on type number, instead got type '${popped}'`)
                    }
                    const beginSize = this.stack.length;
                    
                    while (this.ip < instr.endIp) {
                        this.ip++;
                        this.typecheckOne();
                    }
                    if (this.stack.length !== beginSize) {
                        errorAt(this.source, instr, `Stack size inside and outside of if statement are different; got ${this.stack.length-beginSize} more element(s) in if branch`)
                    }
                } break;
                case "IRepeatStatement": {
                    if (this.stack.length === 0) {
                        errorAt(this.source, instr, "No elements on stack, repeat statement has no iterator");
                    }
                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(this.source, instr, `'repeat' statement only works on type number, instead got type '${popped}'`)
                    }
                } break;
                case "IWhileStatement": {
                    const startingSize = this.stack.length;
                    // run predicate
                    while (this.ip < instr.bodyIp) {
                        this.ip++;
                        this.typecheckOne();
                    }

                    const popped = this.stack.pop();
                    if (!popped?.valid(TNumber())) {
                        errorAt(this.source, instr, `'while' statement predicate only works on type number, instead got type '${popped}'`)
                    }
                    if (this.stack.length !== startingSize) {
                        errorAt(this.source, instr, `While statement predicate should give 1 more element (predicate); instead got ${this.stack.length-startingSize} more element(s) after while statement`)
                    }
                } break;
                case "ILetBinding": {
                    this.bindings.push();
                    if (instr.names.length < this.stack.length) {
                        errorAt(this.source, instr, `binding requires ${instr.names.length} values to be on stack, only received ${this.stack.length}`)
                    }
                    for (const binding of instr.names.toReversed()) {
                        this.bindings.set(binding, this.stack.pop()!);
                    }
                } break;
                case "ICall": {
                    const fn = this.functions[instr.instr];
                    if (fn === undefined) {
                        const binding = this.bindings.get(instr.instr);
                        if (binding === undefined) {
                            errorAt(this.source, instr, `no function or binding called ${instr.instr}`)
                        }
                        this.stack.push(this.bindings.get(instr.instr)!)
                        return;
                    }
                    if (fn.inputs.length > this.stack.length) {
                        errorAt(this.source, instr, `not enough elements on stack to call ${instr.instr}; ${instr.instr} takes ${fn.inputs.length} arguments, instead received ${this.stack.length} arguments.\nExpected: ${fn.inputs.join(", ")}; Received: ${this.stack.toReversed().join(", ")}`)
                    }
                    for (let i = 0; i < fn.inputs.length; i++) {
                        if (!fn.inputs[i].valid(this.stack[i])) {
                            errorAt(this.source, instr, `mismatching argument types; expected: ${fn.inputs.map(a => a.name).join(", ")}; received: ${this.stack.slice(-fn.inputs.length).map(a => a.name).join(", ")}`)
                        }
                    }
                    for (let i = 0; i < fn.inputs.length; i++)
                        this.stack.pop();
                    for (let i = 0; i < fn.outputs.length; i++)
                        this.stack.push(fn.outputs[i]);

                } break;
                case "IFunction": {
                    const fn = {
                        inputs: instr.inputs.map(a => new Type(a)),
                        outputs: instr.output.map(a => new Type(a)),
                    }
                    this.functions[instr.name] = fn;
                    const before = this.stack.map(a => new Type(a.name));
                    this.stack = fn.inputs.map(a => new Type(a.name));
                    this.ip = instr.startIp;
                    while (this.ip < instr.endIp) {
                        this.typecheckOne();
                        this.ip++;
                    }
                    if (fn.outputs.length !== this.stack.length) {
                        errorAt(this.source, instr, `Expected function to leave ${fn.outputs.length} on stack. Expected: ${fn.outputs.map(a => a.name).join(", ")}; Received: ${this.stack.map(a => a.name).join(", ")}`)
                    }
                    for (let i = 0; i < fn.outputs.length; i++) {
                        if (!fn.outputs[i].valid(this.stack[i])) {
                            errorAt(this.source, instr, `Expected function to leave ${fn.outputs.length} on stack. Expected: ${fn.outputs.map(a => a.name).join(", ")}; Received: ${this.stack.map(a => a.name).join(", ")}`)
                        }
                    }
                    this.stack = before;

                } break;
                case "IDropBinding": this.bindings.pop(); break;
                case "IReturn":
                case "INoop": break;
            }
    }
}