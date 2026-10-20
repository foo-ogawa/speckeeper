/**
 * Values the contract declares
 *
 * cli-contract.yaml declares the values an option or an argument takes: an
 * enum, an integer and its bounds. The generated program passes every value as
 * the command line gave it, so the CLI checks them here, against the contract
 * it embeds, before any command runs. A value outside them is an invalid
 * argument and ends like the ones commander finds itself.
 */
import type { Command, CommanderError } from 'commander';
import { CONTRACT_JSON_STR } from '../generated/contract.js';
import { createProgram, type CommandHandlers } from '../generated/program.js';

/** The part of a JSON Schema the contract uses to declare a value */
interface ValueSchema {
  type?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  items?: ValueSchema;
}

/** Keywords the check reads, and the ones that only describe a value */
const KEYWORDS = new Set(['type', 'enum', 'minimum', 'maximum', 'items', 'description', 'default', 'examples', 'title']);

/** Value types the check knows: commander hands over strings, booleans and lists of strings */
const TYPES = new Set(['string', 'boolean', 'array', 'integer']);

interface DeclaredValue {
  name: string;
  schema?: ValueSchema;
}

interface DeclaredCommand {
  arguments?: Array<DeclaredValue & { index: number }>;
  options?: DeclaredValue[];
  exits: Record<string, unknown>;
}

let declaredCommands: Map<string, DeclaredCommand> | undefined;

/** The commands the embedded contract declares, by command ID */
function contractCommands(): Map<string, DeclaredCommand> {
  if (!declaredCommands) {
    const contract = JSON.parse(CONTRACT_JSON_STR) as {
      command_sets: Record<string, { commands: Record<string, DeclaredCommand> }>;
    };
    declaredCommands = new Map(
      Object.values(contract.command_sets).flatMap(set => Object.entries(set.commands)),
    );
  }
  return declaredCommands;
}

/**
 * The contract's declaration of a command of the program. The generated program
 * names a nested command after its contract ID (`review.ingest` is `ingest`
 * under `review`) and registers a parent's own action as a hidden default
 * subcommand of the same name.
 */
function declarationOf(command: Command): DeclaredCommand | undefined {
  const path: string[] = [];
  for (let at: Command | null = command; at?.parent; at = at.parent) path.unshift(at.name());
  if (path.length > 1 && path[path.length - 1] === path[path.length - 2]) path.pop();
  return contractCommands().get(path.join('.'));
}

/** Why `value` is not one of the values `schema` declares, or undefined when it is */
function violation(value: string, schema: ValueSchema): string | undefined {
  // A declaration the check cannot read fails loudly instead of letting every value through
  const unread = Object.keys(schema).find(keyword => !KEYWORDS.has(keyword));
  if (unread !== undefined || (schema.type !== undefined && !TYPES.has(schema.type))) {
    throw new Error(`cli-contract.yaml declares a value with ${unread ? `"${unread}"` : `type "${schema.type}"`}, which the CLI does not check`);
  }
  if (schema.enum && !schema.enum.some(allowed => String(allowed) === value)) {
    return `Allowed choices are ${schema.enum.join(', ')}.`;
  }
  if (schema.type === 'integer') {
    if (!/^-?\d+$/.test(value)) return 'Expected an integer.';
    if (schema.minimum !== undefined && Number(value) < schema.minimum) return `Expected at least ${schema.minimum}.`;
    if (schema.maximum !== undefined && Number(value) > schema.maximum) return `Expected at most ${schema.maximum}.`;
  }
  return undefined;
}

/** The values one option or argument was given, element by element for a list */
function givenValues(value: unknown, schema: ValueSchema): Array<[string, ValueSchema]> {
  if (value === undefined || typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.map(element => [String(element), schema.items ?? schema]);
  return [[String(value), schema]];
}

/**
 * The first value of the invocation outside what the contract declares,
 * worded as commander words an invalid argument; undefined when every value is
 * declared or the command is not one the contract declares.
 */
function undeclaredValue(command: Command): string | undefined {
  const declared = declarationOf(command);
  if (!declared) return undefined;

  for (const argument of declared.arguments ?? []) {
    if (!argument.schema) continue;
    for (const [value, schema] of givenValues(command.processedArgs[argument.index], argument.schema)) {
      const reason = violation(value, schema);
      if (reason) return `error: command-argument value '${value}' is invalid for argument '${argument.name}'. ${reason}`;
    }
  }

  for (const option of declared.options ?? []) {
    if (!option.schema) continue;
    const registered = command.options.find(o => o.long === `--${option.name}`);
    if (!registered) continue;
    for (const [value, schema] of givenValues(command.getOptionValue(registered.attributeName()), option.schema)) {
      const reason = violation(value, schema);
      if (reason) return `error: option '${registered.flags}' argument '${value}' is invalid. ${reason}`;
    }
  }

  return undefined;
}

/**
 * Ends an invocation whose arguments are invalid: writes the message to stderr
 * and returns the exit code. In this contract exit 2 is the input-error exit
 * wherever a command declares it; a command that declares none ends with
 * commander's own exit.
 */
function endInvalidArguments(error: CommanderError, command: Command): number {
  process.stderr.write(`${error.message}\n`);
  return declarationOf(command)?.exits['2'] !== undefined ? 2 : error.exitCode;
}

/**
 * The generated program, with the values the contract declares checked before
 * a command runs. An undeclared value ends like the argument errors commander
 * finds itself.
 */
export function createCheckedProgram(handlers: CommandHandlers, version: string): Command {
  const program = createProgram(handlers, version, { onUsageError: endInvalidArguments });
  program.hook('preAction', (_program, actionCommand) => {
    const message = undeclaredValue(actionCommand);
    if (message) actionCommand.error(message, { code: 'commander.invalidArgument' });
  });
  return program;
}
