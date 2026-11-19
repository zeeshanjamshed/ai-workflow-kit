import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export const interactiveTerminal = Boolean(
  stdin.isTTY && stdout.isTTY && process.env.TERM !== 'dumb',
);
// Scripted commands do not load a terminal renderer or change their output protocol.
const prompts = interactiveTerminal ? await import('@clack/prompts') : undefined;

export class DialogCancelled extends Error {}

function answer<T>(value: T | symbol): T {
  if (typeof value === 'symbol') {
    prompts?.cancel('Cancelled. No further action will run.');
    throw new DialogCancelled('Cancelled.');
  }
  return value;
}

export function intro(message: string) {
  if (prompts) prompts.intro(message);
}

export function outro(message: string) {
  if (prompts) prompts.outro(message);
}

export function note(message: string, title: string) {
  if (prompts) prompts.note(message, title);
  else console.log(message);
}

export function message(text: string, kind: 'info' | 'success' | 'warn' = 'info') {
  if (prompts) prompts.log[kind](text);
  else console.log(text);
}

export type Choice = { value: string; label: string; hint?: string };

export function openDialog() {
  const input = prompts ? undefined : createInterface({ input: stdin, terminal: false });
  const lines = input?.[Symbol.asyncIterator]();
  const dialog = {
    async ask(question: string, required = true): Promise<string> {
      if (prompts) return answer<string>(await prompts.text({ message: question })).trim();
      console.log(question);
      const next = await lines!.next();
      if (next.done) {
        if (required) throw new Error('Input closed. No further action was approved.');
        return '';
      }
      return next.value.trim();
    },
    async select(question: string, options: Choice[], initialValue: string, plain: string) {
      if (prompts)
        return answer<string>(await prompts.select({ message: question, options, initialValue }));
      return dialog.ask(plain);
    },
    async multiselect(question: string, options: Choice[], initialValues: string[], plain: string) {
      if (prompts)
        return answer<string[]>(
          await prompts.multiselect({ message: question, options, initialValues, required: true }),
        );
      return (await dialog.ask(plain))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    },
    async approve(
      question: string,
      keyword = 'apply',
      plain = `Type ${keyword} to approve, or Enter to cancel.`,
    ) {
      if (prompts)
        return answer<boolean>(await prompts.confirm({ message: question, initialValue: false }));
      return (await dialog.ask(plain, false)) === keyword;
    },
    close() {
      input?.close();
    },
  };
  return dialog;
}

export type Dialog = ReturnType<typeof openDialog>;
