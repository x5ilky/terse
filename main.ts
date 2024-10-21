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


if (Deno.args.includes("-d")) {
    let out = "";
    for (let i = 0; i < associated.length; i++) {
        const instr = associated[i];
        if (Deno.args.includes("-dd")) {
            if (instr.file !== filename) {
                continue;
            }
        }
        out += `[${i}] `
        switch(instr.type) {
            case "INumberLiteral": out += `${instr.type}: ${instr.value.toString()}`; break;
            case "IStringLiteral": out += `${instr.type}: ${JSON.stringify(instr.value)}`; break;
            case "IIfStatement": out += `${instr.type}: Else -> ${instr.elseIp} -> ${instr.endIp}`; break;
            case "IRepeatStatement": out += `${instr.type} -> ${instr.endIp}`; break;
            case "IWhileStatement": out += `${instr.type}: Cond -> ${instr.predicateIp} -> ${instr.bodyIp} -> ${instr.endIp}`; break;
            case "ILetBinding": out += `${instr.type}: Bind: ${instr.names}`; break;
            case "ICall": out += `${instr.type}: ${instr.instr}`; break;
            case "IFunction": out += `${instr.type}; Name: ${instr.name}; Start -> ${instr.startIp}; Skip -> ${instr.endIp}`; break;
            case "IImport": out += `${instr.type}: ${instr.path}`; break;
            case "IDropBinding":
            case "IReturn":
            case "INoop": out += `${instr.type}`; break;
        }
        out += "\n";
    }
    Deno.writeTextFileSync("debug.txt", out);
}

const typechecker = new Typechecker(fileAssoc, associated);
typechecker.typecheck();
const interpreter = new Interpreter(fileAssoc, associated);
interpreter.interpret();
