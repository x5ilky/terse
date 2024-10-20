# Terse Lang

Terse Lang is a language designed for quick writing of program that do repeated
mathematical functions. (language to do math homework faster)

## Proposed Example Syntax

```plaintext
# comments

# adding
1 2 + prn # prn prints top element of stack to stdout with a newline

# input
nip sip bip # number input, string input, bool input

# control flow
<cond> if
    ...
end
<n> repeat
    ...
end

while <pred> do
    ...
end

# functions

# prints out a string n times
fn foo
    number string : number do
    let a b do
        a repeat
            b pr 
        end
        a
    end
end
```
