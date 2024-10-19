# Terse Lang

Terse Lang is a language designed for quick writing of program that do repeated
mathematical functions.

## Proposed Example Syntax

```plaintext
# comments

# adding
1 2 + prl # prl prints top element of stack to stdout with a newline

# input
nip sip bip # number input, string input, bool input

# control flow
cond if
    ...
end
n repeat
    ...
end

pred while
    ...
end

10 range foreach i
    ...
end

# functions

# prints out a string n times
fn foo
    a number b string : number do
    a repeat
        b pr 
    end
    a
end
```