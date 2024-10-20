import { associator } from "./assoc.ts";
import { Interpreter } from "./interpreter.ts";
import { Lexer } from "./lexer.ts";

const filename = Deno.args.shift();
if (!filename) {
    console.error("Error: no filename given");
    Deno.exit(1);
}

const file = Deno.readTextFileSync(filename);
const lexer = new Lexer(file, filename);
const associated = associator(file, lexer.lex());
const interpreter = new Interpreter(file, associated);
interpreter.interpret();
