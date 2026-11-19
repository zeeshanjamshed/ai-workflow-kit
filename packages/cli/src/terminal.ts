import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';

export function openDialog() {
  const input = createInterface({ input: stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  return {
    async ask(question: string, required = true): Promise<string> {
      console.log(question);
      const answer = await lines.next();
      if (answer.done) {
        if (required) throw new Error('Input closed. No further action was approved.');
        return '';
      }
      return answer.value.trim();
    },
    close() {
      input.close();
    },
  };
}
