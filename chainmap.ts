export class Chainmap<K, V> {
    stacks: Map<K, V>[];

    constructor() {
        this.stacks = [];
    }

    push() {
        this.stacks.push(new Map());
    }
    pop() {
        this.stacks.pop();
    }
    set(k: K, v: V) {
        this.stacks[this.stacks.length - 1].set(k, v);
    }
    get(k: K) {
        return this.stacks[this.stacks.length - 1].get(k);
    }
}
