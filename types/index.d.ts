export interface EngineOptions {
  allowUndefinedFacts?: boolean;
  pathResolver?: PathResolver;
}

export interface EngineResult {
  events: Event[];
  failureEvents: Event[];
  almanac: Almanac;
  results: RuleResult[];
  failureResults: RuleResult[];
}

export default function engineFactory(
  rules: Array<RuleProperties>,
  options?: EngineOptions
): Engine;

export class Engine {
  constructor(rules?: Array<RuleProperties>, options?: EngineOptions);

  addRule(rule: RuleProperties): this;
  removeRule(ruleOrName: Rule | string): boolean;
  updateRule(rule: Rule): void;

  addOperator(operator: Operator): void;
  addOperator<A, B>(
    operatorName: string,
    callback: OperatorEvaluator<A, B>
  ): void;
  removeOperator(operator: Operator | string): boolean;

  addPipe(pipe: Pipe): void;
  addPipe<A, B>(pipeName: string, callback: PipeEvaluator<A, B>): void;
  removePipe(pipe: Pipe | string): boolean;

  addFact<T>(fact: Fact<T>): this;
  addFact<T>(
    id: string,
    valueCallback: DynamicFactCallback<T> | T,
    options?: FactOptions
  ): this;
  removeFact(factOrId: string | Fact): boolean;
  getFact<T>(factId: string): Fact<T>;
  getUsedFacts(): Set<string>;

  on(eventName: "success", handler: EventHandler): this;
  on(eventName: "failure", handler: EventHandler): this;
  on(eventName: string, handler: EventHandler): this;

  run(facts?: Record<string, any>): Promise<EngineResult>;
  stop(): this;
}

export interface OperatorEvaluator<A, B> {
  (factValue: A, compareToValue: B): boolean;
}

export class Operator<A = unknown, B = unknown> {
  public name: string;
  constructor(
    name: string,
    evaluator: OperatorEvaluator<A, B>,
    validator?: (factValue: A) => boolean
  );
}

export interface PipeEvaluator<A, R> {
  (factValue: A, ...args: any): R;
}

export class Pipe<A = unknown, R = unknown> {
  public name: string;
  constructor(
    name: string,
    evaluator: PipeEvaluator<A, R>,
    validator?: (factValue: A) => boolean
  );
}

export class Almanac {
  factValue<T>(
    factId: string,
    params?: Record<string, any>,
    path?: string
  ): Promise<T>;
  addRuntimeFact(factId: string, value: any): void;
}

export type FactOptions = {
  cache?: boolean;
  priority?: number;
};

export type DynamicFactCallback<T = unknown> = (
  params: Record<string, any>,
  almanac: Almanac
) => T;

export class Fact<T = unknown> {
  id: string;
  priority: number;
  options: FactOptions;
  value?: T;
  calculationMethod?: DynamicFactCallback<T>;

  constructor(
    id: string,
    value: T | DynamicFactCallback<T>,
    options?: FactOptions
  );
}

export interface Event {
  type: string;
  params?: Record<string, any>;
}

export type PathResolver = (value: object, path: string) => any;

export type EventHandler = (
  event: Event,
  almanac: Almanac,
  ruleResult: RuleResult
) => void;

export interface RuleProperties {
  conditions: TopLevelCondition;
  event: Event;
  name?: string;
  priority?: number;
  onSuccess?: EventHandler;
  onFailure?: EventHandler;
}
export type RuleSerializable = Pick<
  Required<RuleProperties>,
  "conditions" | "event" | "name" | "priority"
>;

export interface RuleResult {
  name: string;
  conditions: TopLevelCondition;
  event?: Event;
  priority?: number;
  result: any;
}

export class Rule implements RuleProperties {
  constructor(ruleProps: RuleProperties | string);
  name: string;
  conditions: TopLevelCondition;
  event: Event;
  priority: number;
  setConditions(conditions: TopLevelCondition): this;
  setEvent(event: Event): this;
  setPriority(priority: number): this;
  getUsedFacts(): Set<string>;
  toJSON(): string;
  toJSON<T extends boolean>(
    stringify: T
  ): T extends true ? string : RuleSerializable;
}

interface ConditionProperties {
  fact: string;
  operator: string;
  value: { fact: string } | any;
  path?: string;
  priority?: number;
  params?: Record<string, any>;
}

type NestedCondition = ConditionProperties | TopLevelCondition;
type AllConditions = { all: NestedCondition[] };
type AnyConditions = { any: NestedCondition[] };
export type TopLevelCondition = AllConditions | AnyConditions;
