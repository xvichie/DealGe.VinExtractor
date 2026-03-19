// utils/profiler.ts

export class Profiler {
  private startTime: number;
  private marks: Record<string, number> = {};

  constructor(private label: string) {
    this.startTime = Date.now();
  }

  mark(name: string) {
    this.marks[name] = Date.now();
  }

  end() {
    const total = Date.now() - this.startTime;

    console.log(`\n⏱ PROFILER: ${this.label}`);
    console.log(`Total: ${total}ms`);

    let prev = this.startTime;
    for (const [name, time] of Object.entries(this.marks)) {
      console.log(`${name}: ${time - prev}ms`);
      prev = time;
    }

    console.log("------\n");
  }

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    console.log(`⏱ ${name}: ${duration}ms`);
    return result;
  }
}