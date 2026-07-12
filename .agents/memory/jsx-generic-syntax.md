---
name: JSX generic component syntax
description: Babel/Vite parser rejects <Component<T> syntax in TSX files — workaround pattern.
---

**Rule:** Never write `<Component<T> ...>` in TSX files. Babel's JSX parser treats it as an HTML tag and throws "Unexpected token".

**Why:** Vite uses Babel to transform JSX, and the `@babel/parser` does not support TypeScript generic arguments in JSX element names, even though tsc accepts them.

**How to apply:** When a generic component needs a specific `T` at a call site, use one of:
1. Wrap onChange/callbacks in an arrow function with a cast: `onChange={(t) => setState(t as MyType)}`
2. Change the prop type to `React.Dispatch<React.SetStateAction<T>>` when the consumer IS a setter
3. Use a non-generic alternative (e.g. pass a string union prop)
