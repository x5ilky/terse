import * as path from "jsr:@std/path"
import { associator } from "./assoc.ts";
import { Interpreter } from "./interpreter.ts";
import { Lexer } from "./lexer.ts";
import { Typechecker } from "./typechecker.ts";

let filename = Deno.args.shift();
if (!filename) {
    console.error("Error: no filename given");
    Deno.exit(1);
}

filename = path.join(Deno.cwd(), filename);

export type FileAssoc = {[path: string]: string}
const fileAssoc: FileAssoc = {};

const file = Deno.readTextFileSync(filename);
fileAssoc[filename] = file;
const lexer = new Lexer(file, filename);
const associated = associator(fileAssoc, lexer.lex());

if (0) {
    let out = "";
    for (let i = 0; i < associated.length; i++) {
        const instr = associated[i];
        out += `${i}: ${instr.type}`;
        if ("endIp" in instr) {
            out += ` -> ${instr.endIp}`;
        }
        out += "\n";
    }
    Deno.writeTextFileSync("debug.txt", out);
}

const typechecker = new Typechecker(fileAssoc, associated);
typechecker.typecheck();
const interpreter = new Interpreter(fileAssoc, associated);
interpreter.interpret();
