type Entry<T> = {
  value: T
  next: Entry<T> | null
}

export class LinkedQueue<T> {
  #head: Entry<T> | null = null
  #tail: Entry<T> | null = null
  #size: number = 0

  push(value: T): void {
    if (value === null) {
      throw new Error('Cannot push null into LinkedQueue')
    }
    const entry: Entry<T> = { value, next: null }
    if (this.#tail) {
      this.#tail.next = entry
      this.#tail = entry
    } else {
      this.#head = entry
      this.#tail = entry
    }
    this.#size++
  }

  poll(): T | null {
    if (this.#head) {
      const value = this.#head.value
      this.#head = this.#head.next
      this.#size--
      if (this.#size === 0) {
        this.#tail = null
      }
      return value
    }
    return null
  }

  public get size(): number {
    return this.#size
  }
}
